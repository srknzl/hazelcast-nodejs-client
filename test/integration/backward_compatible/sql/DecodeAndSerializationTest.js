/*
 * Copyright (c) 2008-2021, Hazelcast, Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

const { Lang } = require('../../remote_controller/remote-controller_types');
const { SqlColumnType } = require('../../../../lib/sql/SqlColumnMetadata');
const {
    HzLocalDate,
    HzLocalDateTime,
    HzOffsetDateTime,
    HzLocalTime
} = require('../../../../lib/sql/DatetimeWrapperClasses');
const chai = require('chai');
const long = require('long');
const should = chai.should();
const RC = require('../../RC');
const TestUtil = require('../../../TestUtil');
const { Client } = require('../../../../');

describe('Decode/Serialize Test', function () {
    let client;
    let cluster;
    let someMap;
    let mapName;

    const SERVER_CONFIG = `
                <hazelcast xmlns="http://www.hazelcast.com/schema/config"
                xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xsi:schemaLocation="http://www.hazelcast.com/schema/config
                http://www.hazelcast.com/schema/config/hazelcast-config-4.0.xsd">
                    <serialization>
                        <portable-factories>
                            <portable-factory factory-id="100">com.hazelcast.client.test.ClassroomFactory
                            </portable-factory>
                        </portable-factories>
                        <data-serializable-factories>
                            <data-serializable-factory factory-id="1000">com.hazelcast.client.test.AddressFactory
                            </data-serializable-factory>
                        </data-serializable-factories>
                    </serialization>
                </hazelcast>
            `;

    class Address {
        constructor(street, zipCode) {
            this.zipCode = zipCode;
            this.street = street;
            this.factoryId = 1000;
            this.classId = 100;
        }

        readData(input) {
            this.street = input.readString();
            this.zipCode = input.readInt();
        }

        writeData(output) {
            output.writeString(this.street);
            output.writeInt(this.zipCode);
        }
    }

    class Student {
        constructor(age, height) {
            this.age = age;
            this.height = height;
            this.factoryId = 666;
            this.classId = 6;
        }

        readPortable(reader) {
            this.age = reader.readLong('age');
            this.height = reader.readFloat('height');
        }

        writePortable(writer) {
            writer.writeLong('age', this.age);
            writer.writeFloat('height', this.height);
        }
    }

    class Classroom {
        constructor(className, students) {
            this.students = students;
            this.className = className;
            this.factoryId = 100;
            this.classId = 333;
        }

        readPortable(reader) {
            this.className = reader.readString('className');
            this.students = reader.readPortableArray('students');
        }

        writePortable(writer) {
            writer.writeString('className', this.className);
            writer.writePortableArray('students', this.students);
        }
    }

    class SmallClassroom {
        constructor(className, student) {
            this.student = student;
            this.className = className;
            this.factoryId = 100;
            this.classId = 333;
        }

        readPortable(reader) {
            this.className = reader.readString('className');
            this.student = reader.readPortable('student');
        }

        writePortable(writer) {
            writer.writeString('className', this.className);
            writer.writePortable('student', this.student);
        }
    }

    const otherPortFac = (classId) => {
        if (classId === 333) return new Classroom();
        return null;
    };

    const portableFactory = (classId) => {
        if (classId === 6) return new Student();
        return null;
    };

    const sampleDataSerializableFactory = (classId) => {
        if (classId === 100) {
            return new Address();
        }
        return null;
    };

    const sortByKey = (array) => {
        array.sort((a, b) => {
            if (a['__key'] < b['__key']) return -1;
            else if (a['__key'] > b['__key']) return 1;
            else return 0;
        });
    };

    const validateResults = (rows, expectedKeys, expectedValues) => {
        rows.length.should.be.eq(expectedValues.length);

        for (let i = 0; i < rows.length; i++) {
            rows[i]['this'].should.be.eq(expectedValues[i]);
            rows[i]['__key'].should.be.eq(expectedKeys[i]);
        }
    };

    before(async function () {
        TestUtil.markClientVersionAtLeast(this, '4.2');
        cluster = await RC.createCluster(null, SERVER_CONFIG);
        await RC.startMember(cluster.id);
        client = await Client.newHazelcastClient({
            clusterName: cluster.id,
            serialization: {
                dataSerializableFactories: {
                    1000: sampleDataSerializableFactory
                },
                portableFactories: {
                    666: portableFactory,
                    100: otherPortFac
                }
            }
        });
    });

    beforeEach(async function () {
        mapName = TestUtil.randomString(10);
        someMap = await client.getMap(mapName);
    });

    after(async function () {
        await RC.terminateCluster(cluster.id);
        await client.shutdown();
    });

    afterEach(async function () {
        await someMap.clear();
    });

    it('should be able to decode/serialize VARCHAR', async function () {
        const script =
            `
            var map = instance_0.getMap("${mapName}");
            for (var key = 0; key < 10; key++) {
                map.set(new java.lang.Integer(key), new java.lang.String(key.toString()));
            }
        `;

        await RC.executeOnController(cluster.id, script, Lang.JAVASCRIPT);
        const result = client.getSqlService().execute(`SELECT * FROM ${mapName} WHERE this = ? OR this = ?`, ['7', '2']);
        const rowMetadata = await result.getRowMetadata();
        rowMetadata.getColumnByIndex(rowMetadata.findColumn('this')).type.should.be.eq(SqlColumnType.VARCHAR);

        const rows = [];

        for await (const row of result) {
            rows.push(row);
        }

        sortByKey(rows);

        const expectedValues = ['2', '7'];
        const expectedKeys = [2, 7];

        validateResults(rows, expectedKeys, expectedValues);
    });
    it('should be able to decode/serialize BOOLEAN', async function () {
        const script =
            `
            var map = instance_0.getMap("${mapName}");
            for (var key = 0; key < 10; key++) {
                map.set(new java.lang.Integer(key), new java.lang.Boolean(key % 2 == 0));
            }
        `;
        await RC.executeOnController(cluster.id, script, Lang.JAVASCRIPT);
        const result = client.getSqlService().execute(`SELECT * FROM ${mapName} WHERE this = ?`, [true]);
        const rowMetadata = await result.getRowMetadata();
        rowMetadata.getColumnByIndex(rowMetadata.findColumn('this')).type.should.be.eq(SqlColumnType.BOOLEAN);

        const rows = [];

        for await (const row of result) {
            rows.push(row);
        }

        sortByKey(rows);
        const expectedKeys = [0, 2, 4, 6, 8];
        const expectedValues = [true, true, true, true, true];

        validateResults(rows, expectedKeys, expectedValues);
    });
    it('should be able to decode/serialize TINYINT', async function () {
        const script =
            `
            var map = instance_0.getMap("${mapName}");
            for (var key = 0; key < 10; key++) {
                map.set(new java.lang.Integer(key), new java.lang.Byte(key * 2));
            }
        `;
        await RC.executeOnController(cluster.id, script, Lang.JAVASCRIPT);
        const result = client.getSqlService().execute(
            `SELECT * FROM ${mapName} WHERE this > ? AND this < ?`,
            [long.fromNumber(10), long.fromNumber(16)]
        );
        const rowMetadata = await result.getRowMetadata();
        rowMetadata.getColumnByIndex(rowMetadata.findColumn('this')).type.should.be.eq(SqlColumnType.TINYINT);

        const rows = [];

        for await (const row of result) {
            rows.push(row);
        }
        sortByKey(rows);

        const expectedValues = [12, 14];
        const expectedKeys = [6, 7];

        validateResults(rows, expectedKeys, expectedValues);
    });
    it('should be able to decode/serialize SMALLINT', async function () {
        const script =
            `
            var map = instance_0.getMap("${mapName}");
            for (var key = 0; key < 10; key++) {
                map.set(new java.lang.Integer(key), new java.lang.Short(key * 2));
            }
        `;
        await RC.executeOnController(cluster.id, script, Lang.JAVASCRIPT);
        const result = client.getSqlService().execute(
            `SELECT * FROM ${mapName} WHERE this > ? AND this < ?`,
            [long.fromNumber(8), long.fromNumber(16)]
        );
        const rowMetadata = await result.getRowMetadata();
        rowMetadata.getColumnByIndex(rowMetadata.findColumn('this')).type.should.be.eq(SqlColumnType.SMALLINT);

        const rows = [];

        for await (const row of result) {
            rows.push(row);
        }
        sortByKey(rows);

        const expectedValues = [10, 12, 14];
        const expectedKeys = [5, 6, 7];

        validateResults(rows, expectedKeys, expectedValues);
    });
    it('should be able to decode/serialize INTEGER', async function () {
        const script =
            `
            var map = instance_0.getMap("${mapName}");
            for (var key = 0; key < 10; key++) {
                map.set(new java.lang.Integer(key), new java.lang.Integer(key * 2));
            }
        `;
        await RC.executeOnController(cluster.id, script, Lang.JAVASCRIPT);
        const result = client.getSqlService().execute(
            `SELECT * FROM ${mapName} WHERE this > ? AND this < ?`,
            [long.fromNumber(10), long.fromNumber(20)]
        );
        const rowMetadata = await result.getRowMetadata();
        rowMetadata.getColumnByIndex(rowMetadata.findColumn('this')).type.should.be.eq(SqlColumnType.INTEGER);

        const rows = [];

        for await (const row of result) {
            rows.push(row);
        }
        sortByKey(rows);

        const expectedValues = [12, 14, 16, 18];
        const expectedKeys = [6, 7, 8, 9];

        validateResults(rows, expectedKeys, expectedValues);
    });
    it('should be able to decode/serialize BIGINT', async function () {
        const script =
            `
            var map = instance_0.getMap("${mapName}");
            for (var key = 0; key < 10; key++) {
                map.set(new java.lang.Integer(key), new java.lang.Long(key * 2));
            }
        `;
        await RC.executeOnController(cluster.id, script, Lang.JAVASCRIPT);
        const result = client.getSqlService().execute(
            `SELECT * FROM ${mapName} WHERE this > ? AND this < ?`,
            [long.fromNumber(10), long.fromNumber(18)]
        );
        const rowMetadata = await result.getRowMetadata();
        rowMetadata.getColumnByIndex(rowMetadata.findColumn('this')).type.should.be.eq(SqlColumnType.BIGINT);

        const rows = [];

        for await (const row of result) {
            rows.push(row);
        }
        sortByKey(rows);

        const expectedValues = [long.fromNumber(12), long.fromNumber(14), long.fromNumber(16)];
        const expectedKeys = [6, 7, 8];

        rows.length.should.be.eq(expectedValues.length);

        for (let i = 0; i < rows.length; i++) {
            (rows[i]['this'].eq(expectedValues[i])).should.be.true;
            rows[i]['__key'].should.be.eq(expectedKeys[i]);
        }
    });
    it('should be able to decode/serialize DECIMAL', async function () {
        const script =
            `
            var map = instance_0.getMap("${mapName}");
            // scale is equals to bigint length
            map.set(new java.lang.Integer(0), new java.math.BigDecimal('0.1111112983672389172378619283677891'));
            // scale is more than bigint length
            map.set(new java.lang.Integer(1), new java.math.BigDecimal('0.00000000000000000000000000000001'));
            // scale is negative
            map.set(new java.lang.Integer(2), new java.math.BigDecimal('132165413213543156412374800000000'));
            // scale is zero
            map.set(new java.lang.Integer(3), new java.math.BigDecimal('1234'));
        `;
        await RC.executeOnController(cluster.id, script, Lang.JAVASCRIPT);
        const result = client.getSqlService().execute(
            `SELECT * FROM ${mapName} WHERE this > CAST(? AS DECIMAL) AND this < CAST(? AS DECIMAL)`,
            ['-0.00000000000000000000000000000001', '1.0000000000000231213123123125465462513214653123']
        );
        const rowMetadata = await result.getRowMetadata();
        rowMetadata.getColumnByIndex(rowMetadata.findColumn('this')).type.should.be.eq(SqlColumnType.DECIMAL);

        const rows = [];

        for await (const row of result) {
            rows.push(row);
        }
        sortByKey(rows);

        const expectedValues = [
            '0.1111112983672389172378619283677891',
            '0.00000000000000000000000000000001',
        ];

        const expectedKeys = [0, 1];

        validateResults(rows, expectedKeys, expectedValues);
    });
    it('should be able to decode/serialize REAL', async function () {
        const script =
            `
            var map = instance_0.getMap("${mapName}");
            for (var key = 1; key < 10; key++) {
                map.set(new java.lang.Integer(key), new java.lang.Float('0.' + key.toString()));
            }
        `;
        await RC.executeOnController(cluster.id, script, Lang.JAVASCRIPT);
        const result = client.getSqlService().execute(
            `SELECT * FROM ${mapName} WHERE this > CAST(? AS REAL) AND this < CAST(? AS REAL)`,
            [-0.5, 0.5]
        );
        const rowMetadata = await result.getRowMetadata();
        rowMetadata.getColumnByIndex(rowMetadata.findColumn('this')).type.should.be.eq(SqlColumnType.REAL);

        const rows = [];

        for await (const row of result) {
            rows.push(row);
        }
        sortByKey(rows);

        const expectedKeys = [1, 2, 3, 4];
        const expectedValues = [0.1, 0.2, 0.3, 0.4];

        rows.length.should.be.eq(expectedValues.length);

        for (let i = 0; i < rows.length; i++) {
            (rows[i]['this'] - expectedValues[i]).should.be.lessThan(1e-5);
            rows[i]['__key'].should.be.eq(expectedKeys[i]);
        }
    });
    it('should be able to decode/serialize DOUBLE', async function () {
        const script =
            `
            var map = instance_0.getMap("${mapName}");
            for (var key = 1; key < 10; key++) {
                map.set(new java.lang.Integer(key), new java.lang.Double('0.' + key.toString()));
            }
        `;
        await RC.executeOnController(cluster.id, script, Lang.JAVASCRIPT);
        const result = client.getSqlService().execute(
            `SELECT * FROM ${mapName} WHERE this > ? AND this < ?`, // cast it if default number type is different
            [-0.7, 0.7]
        );
        const rowMetadata = await result.getRowMetadata();
        rowMetadata.getColumnByIndex(rowMetadata.findColumn('this')).type.should.be.eq(SqlColumnType.DOUBLE);

        const rows = [];

        for await (const row of result) {
            rows.push(row);
        }
        sortByKey(rows);

        const expectedKeys = [1, 2, 3, 4, 5, 6];
        const expectedValues = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6];

        rows.length.should.be.eq(expectedValues.length);

        for (let i = 0; i < rows.length; i++) {
            (rows[i]['this'] - expectedValues[i]).should.be.lessThan(1e-5);
            rows[i]['__key'].should.be.eq(expectedKeys[i]);
        }
    });
    it('should be able to decode/serialize DATE', async function () {
        const script =
            `
            var map = instance_0.getMap("${mapName}");
            for (var key = 1; key < 12; key++) {
                map.set(new java.lang.Integer(key), java.time.LocalDate.of(key+2,key+1,key));
            }
        `;
        await RC.executeOnController(cluster.id, script, Lang.JAVASCRIPT);
        const result = client.getSqlService().execute(
            `SELECT * FROM ${mapName} WHERE this > CAST (? AS DATE) AND this < CAST (? AS DATE)`,
            [new HzLocalDate(1, 1, 1), new HzLocalDate(5, 5, 5)]
        );
        const rowMetadata = await result.getRowMetadata();
        rowMetadata.getColumnByIndex(rowMetadata.findColumn('this')).type.should.be.eq(SqlColumnType.DATE);

        const rows = [];

        for await (const row of result) {
            rows.push(row);
        }
        sortByKey(rows);

        const expectedKeys = [1, 2, 3];
        const expectedBaseValues = {
            year: 3,
            month: 2,
            date: 1
        };
        rows.length.should.be.eq(expectedKeys.length);

        for (let i = 0; i < rows.length; i++) {
            const date = rows[i]['this'];
            date.should.be.instanceof(HzLocalDate);

            date.getYear().should.be.eq(expectedBaseValues.year + i);
            date.getMonth().should.be.eq(expectedBaseValues.month + i);
            date.getDate().should.be.eq(expectedBaseValues.date + i);

            rows[i]['__key'].should.be.eq(expectedKeys[i]);
        }
    });
    it('should be able to decode/serialize TIME', async function () {
        const script = `
                    var map = instance_0.getMap("${mapName}");
                    for (var key = 1; key < 12; key++) {
                        map.set(new java.lang.Integer(key), java.time.LocalTime.of(key+3,key+2,key+1,key + 1e8));
                    }
                `;
        await RC.executeOnController(cluster.id, script, Lang.JAVASCRIPT);
        const result = client.getSqlService().execute(
            `SELECT * FROM ${mapName} WHERE this > CAST (? AS TIME) AND this < CAST (? AS TIME)`,
            [new HzLocalTime(1, 0, 0, 0), new HzLocalTime(10, 0, 0, 0)]
        );
        const rowMetadata = await result.getRowMetadata();
        rowMetadata.getColumnByIndex(rowMetadata.findColumn('this')).type.should.be.eq(SqlColumnType.TIME);

        const rows = [];

        for await (const row of result) {
            rows.push(row);
        }
        sortByKey(rows);

        const expectedKeys = [1, 2, 3, 4, 5, 6];
        const expectedBaseValue = {
            hour: 4,
            minute: 3,
            second: 2,
            nano: 1 + 1e8
        };
        rows.length.should.be.eq(expectedKeys.length);

        for (let i = 0; i < rows.length; i++) {
            const time = rows[i]['this'];
            time.should.be.instanceof(HzLocalTime);

            time.getHour().should.be.eq(expectedBaseValue.hour + i);
            time.getMinute().should.be.eq(expectedBaseValue.minute + i);
            time.getSecond().should.be.eq(expectedBaseValue.second + i);
            time.getNano().should.be.eq(expectedBaseValue.nano + i);

            rows[i]['__key'].should.be.eq(expectedKeys[i]);
        }
    });
    it('should be able to decode/serialize TIMESTAMP', async function () {
        const script = `
                    var map = instance_0.getMap("${mapName}");
                    for (var key = 1; key < 12; key++) {
                        map.set(
                          new java.lang.Integer(key),
                          java.time.LocalDateTime.of(key+6, key, key+4, key+3, key+2, key+1, key + 1e8)
                        );
                    }
        `;
        await RC.executeOnController(cluster.id, script, Lang.JAVASCRIPT);
        const result = client.getSqlService().execute(
            `SELECT * FROM ${mapName} WHERE this > CAST (? AS TIMESTAMP) AND this < CAST (? AS TIMESTAMP)`,
            [
                new HzLocalDateTime(new HzLocalDate(1, 6, 5), new HzLocalTime(4, 3, 2, 1)),
                new HzLocalDateTime(new HzLocalDate(9, 6, 5), new HzLocalTime(4, 3, 2, 1))
            ]
        );
        const rowMetadata = await result.getRowMetadata();
        rowMetadata.getColumnByIndex(rowMetadata.findColumn('this')).type.should.be.eq(SqlColumnType.TIMESTAMP);

        const rows = [];

        for await (const row of result) {
            rows.push(row);
        }
        sortByKey(rows);

        const expectedKeys = [1, 2, 3];
        const expectedBaseValue = {
            year: 7,
            month: 1,
            date: 5,
            hour: 4,
            minute: 3,
            second: 2,
            nano: 1 + 1e8
        };

        rows.length.should.be.eq(expectedKeys.length);

        for (let i = 0; i < rows.length; i++) {
            const datetime = rows[i]['this'];
            datetime.should.be.instanceof(HzLocalDateTime);

            datetime.getHzLocalDate().getYear().should.be.eq(expectedBaseValue.year + i);
            datetime.getHzLocalDate().getMonth().should.be.eq(expectedBaseValue.month + i);
            datetime.getHzLocalDate().getDate().should.be.eq(expectedBaseValue.date + i);

            datetime.getHzLocalTime().getHour().should.be.eq(expectedBaseValue.hour + i);
            datetime.getHzLocalTime().getMinute().should.be.eq(expectedBaseValue.minute + i);
            datetime.getHzLocalTime().getSecond().should.be.eq(expectedBaseValue.second + i);
            datetime.getHzLocalTime().getNano().should.be.eq(expectedBaseValue.nano + i);

            rows[i]['__key'].should.be.eq(expectedKeys[i]);
        }
    });
    it('should be able to decode/serialize TIMESTAMP WITH TIMEZONE', async function () {
        const script =
            `
            var map = instance_0.getMap("${mapName}");
            for (var key = 1; key < 12; key++) {
                map.set(
                  new java.lang.Integer(key),
                  java.time.OffsetDateTime.of(
                    key+6, key, key+4, key+3, key+2, key+1, key + 1e8,
                    java.time.ZoneOffset.ofTotalSeconds(key * key * key)
                  )
                );
            }
        `;
        await RC.executeOnController(cluster.id, script, Lang.JAVASCRIPT);
        const result = client.getSqlService().execute(
            `SELECT * FROM ${mapName} WHERE this > CAST (? AS TIMESTAMP_WITH_TIME_ZONE)` +
            'AND this < CAST (? AS TIMESTAMP_WITH_TIME_ZONE)',
            [
                HzOffsetDateTime.fromHzLocalDateTime(
                    new HzLocalDateTime(new HzLocalDate(1, 6, 5), new HzLocalTime(4, 3, 2, 1)),
                    0
                ),
                HzOffsetDateTime.fromHzLocalDateTime(
                    new HzLocalDateTime(new HzLocalDate(9, 6, 5), new HzLocalTime(4, 3, 2, 1)),
                    0
                )
            ]
        );
        const rowMetadata = await result.getRowMetadata();
        rowMetadata.getColumnByIndex(rowMetadata.findColumn('this'))
            .type.should.be.eq(SqlColumnType.TIMESTAMP_WITH_TIME_ZONE);

        const rows = [];

        for await (const row of result) {
            rows.push(row);
        }
        sortByKey(rows);

        const expectedKeys = [1, 2, 3];
        const expectedBaseValue = {
            year: 7,
            month: 1,
            date: 5,
            hour: 4,
            minute: 3,
            second: 2,
            nano: 1 + 1e8,
            offsetSeconds: 1
        };
        rows.length.should.be.eq(expectedKeys.length);

        for (let i = 0; i < rows.length; i++) {
            const datetimeWithOffset = rows[i]['this'];
            datetimeWithOffset.should.be.instanceof(HzOffsetDateTime);

            datetimeWithOffset.getHzLocalDateTime().getHzLocalDate().getYear().should.be.eq(expectedBaseValue.year + i);
            datetimeWithOffset.getHzLocalDateTime().getHzLocalDate().getMonth().should.be.eq(expectedBaseValue.month + i);
            datetimeWithOffset.getHzLocalDateTime().getHzLocalDate().getDate().should.be.eq(expectedBaseValue.date + i);

            datetimeWithOffset.getHzLocalDateTime().getHzLocalTime().getHour().should.be.eq(expectedBaseValue.hour + i);
            datetimeWithOffset.getHzLocalDateTime().getHzLocalTime().getMinute().should.be.eq(expectedBaseValue.minute + i);
            datetimeWithOffset.getHzLocalDateTime().getHzLocalTime().getSecond().should.be.eq(expectedBaseValue.second + i);
            datetimeWithOffset.getHzLocalDateTime().getHzLocalTime().getNano().should.be.eq(expectedBaseValue.nano + i);

            datetimeWithOffset.getOffsetSeconds().should.be.eq((expectedBaseValue.offsetSeconds + i) ** 3);

            rows[i]['__key'].should.be.eq(expectedKeys[i]);
        }
    });
    it('should be able to decode/serialize OBJECT(portable)', async function () {
        const student1 = new Student(long.fromNumber(12), 123.23);
        const student2 = new Student(long.fromNumber(15), 123.23);
        const student3 = new Student(long.fromNumber(17), 123.23);
        await someMap.put(0, student1);
        await someMap.put(1, student2);
        await someMap.put(2, student3);

        const result = client.getSqlService().execute(`SELECT * FROM ${mapName} WHERE age > ? AND age < ?`,
            [long.fromNumber(13), long.fromNumber(18)]
        );

        const rowMetadata = await result.getRowMetadata();
        rowMetadata.getColumnByIndex(rowMetadata.findColumn('age')).type.should.be.eq(SqlColumnType.BIGINT);
        rowMetadata.getColumnByIndex(rowMetadata.findColumn('height')).type.should.be.eq(SqlColumnType.REAL);

        const rows = [];

        for await (const row of result) {
            rows.push(row);
        }
        sortByKey(rows);

        const expectedKeys = [1, 2];
        const expectedValues = [student2, student3];

        rows.length.should.be.eq(expectedValues.length);

        for (let i = 0; i < rows.length; i++) {
            (rows[i]['age'].eq(expectedValues[i].age)).should.be.true;
            (rows[i]['height'] - expectedValues[i].height).should.be.lessThan(1e-5);
            rows[i]['__key'].should.be.eq(expectedKeys[i]);
        }
    });
    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('should be able to decode/serialize OBJECT(identified data serializable)', async function () {
        const address1 = new Address('a', 2);
        const address2 = new Address('b', 3);
        const address3 = new Address('c', 4);

        await someMap.put(0, address1);
        await someMap.put(1, address2);
        await someMap.put(2, address3);

        // console.log(await someMap.get(0));
        const result = client.getSqlService().execute(`SELECT * FROM ${mapName} WHERE zipCode > ? AND zipCode < ?`,
            [long.fromNumber(2), long.fromNumber(5)]);

        const rowMetadata = await result.getRowMetadata();
        rowMetadata.getColumnByIndex(rowMetadata.findColumn('street')).type.should.be.eq(SqlColumnType.VARCHAR);
        rowMetadata.getColumnByIndex(rowMetadata.findColumn('zipCode')).type.should.be.eq(SqlColumnType.INTEGER);

        const rows = [];

        for await (const row of result) {
            rows.push(row);
        }
        sortByKey(rows);

        const expectedKeys = [1, 2];
        const expectedValues = [address2, address3];

        rows.length.should.be.eq(expectedValues.length);

        for (let i = 0; i < rows.length; i++) {
            rows[i]['street'].should.be.eq(expectedValues[i].street);
            rows[i]['zipCode'].should.be.eq(expectedValues[i].zipCode);
            rows[i]['__key'].should.be.eq(expectedKeys[i]);
        }
    });
    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('should be able to decode/serialize nested portable array', async function () {
        const classroom = new Classroom('asd', [
            new Student(long.fromNumber(12), 123.23),
            new Student(long.fromNumber(13), 123.23)
        ]);

        await someMap.put(0, classroom);
        // console.log(await someMap.get(0));
        const result = client.getSqlService().execute(`SELECT * FROM ${mapName}`);

        const rowMetadata = await result.getRowMetadata();
        rowMetadata.getColumnByIndex(rowMetadata.findColumn('students')).type.should.be.eq(SqlColumnType.OBJECT);
        rowMetadata.getColumnByIndex(rowMetadata.findColumn('className')).type.should.be.eq(SqlColumnType.VARCHAR);

        const row = (await result.next()).value;
        row['className'].should.be.eq(classroom.className);
        row['students'].should.be.eq(classroom.students);
        row['__key'].should.be.eq(0);
    });
    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('should be able to decode/serialize nested portable', async function () {
        const classroom = new SmallClassroom('asd', new Student(long.fromNumber(13), 123.23));
        await someMap.put(0, classroom);

        // console.log(await someMap.get(0));
        const result = client.getSqlService().execute(`SELECT * FROM ${mapName}`);

        const rowMetadata = await result.getRowMetadata();
        rowMetadata.getColumnByIndex(rowMetadata.findColumn('student')).type.should.be.eq(SqlColumnType.OBJECT);
        rowMetadata.getColumnByIndex(rowMetadata.findColumn('className')).type.should.be.eq(SqlColumnType.VARCHAR);

        const row = (await result.next()).value;
        row['className'].should.be.eq(classroom.className);
        row['student'].should.be.eq(classroom.student);
        row['__key'].should.be.eq(0);
    });
    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('should be able to decode/serialize NULL', async function () {
        const result = client.getSqlService().execute(`SELECT * FROM ${mapName}`);
        const rowMetadata = await result.getRowMetadata();
        rowMetadata.getColumnByIndex(rowMetadata.findColumn('this'))
            .type.should.be.eq(SqlColumnType.NULL);
        const row = await result.next();
        should.equal(row['this'], null);
        row['__key'].should.be.eq(0);
    });
});