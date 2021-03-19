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
/** @ignore *//** */

import {InternalIndexConfig} from '../config/IndexConfig';
import {IndexType} from '../config/IndexType';
import {InternalBitmapIndexOptions} from '../config/BitmapIndexOptions';

/**
 * Maximum number of attributes allowed in the index.
 */
const MAX_ATTRIBUTES = 255;

/**
 * Pattern to stripe away "this." prefix.
 */
const THIS_PATTERN = new RegExp('^this\\.');

/** @internal */
export class IndexUtil {

    /**
     * Validates provided index config and normalizes its name and attribute names.
     *
     * @param mapName Name of the map
     * @param config User-provided index config.
     * @return Normalized index config.
     * @throws TypeError If index configuration is invalid.
     */
    static validateAndNormalize(mapName: string, config: InternalIndexConfig): InternalIndexConfig {
        // Validate attributes
        const originalAttributeNames = config.attributes;

        if (originalAttributeNames.length === 0) {
            throw new TypeError('Index must have at least one attribute: ' + config);
        }

        if (originalAttributeNames.length > MAX_ATTRIBUTES) {
            throw new TypeError('Index cannot have more than ' + MAX_ATTRIBUTES + ' attributes: ' + config);
        }

        const type: IndexType = config.type;
        if (type === IndexType.BITMAP && originalAttributeNames.length > 1) {
            throw new TypeError('Composite bitmap indexes are not supported: ' + config);
        }

        const normalizedAttributeNames = new Array<string>(originalAttributeNames.length);
        for (let i = 0; i < originalAttributeNames.length; i++) {
            let originalAttributeName = originalAttributeNames[i];
            this.validateAttribute(config.name, originalAttributeName);

            originalAttributeName = originalAttributeName.trim();
            const normalizedAttributeName = this.canonicalizeAttribute(originalAttributeName);

            const existingIdx = normalizedAttributeNames.indexOf(normalizedAttributeName);

            if (existingIdx !== -1) {
                const duplicateOriginalAttributeName = originalAttributeNames[existingIdx];

                if (duplicateOriginalAttributeName === originalAttributeName) {
                    throw new TypeError('Duplicate attribute name [attributeName= '
                        + originalAttributeName + ', indexConfig=' + config + ']');
                } else {
                    throw new TypeError('Duplicate attribute names [attributeName1='
                        + duplicateOriginalAttributeName + ', attributeName2='
                        + originalAttributeName + ', indexConfig=' + config + ']');
                }
            }

            normalizedAttributeNames[i] = normalizedAttributeName;
        }

        let name = config.name;
        // Construct final index
        if (name?.trim().length === 0) {
            name = undefined;
        }

        const normalizedConfig = this.buildNormalizedConfig(mapName, type, name, normalizedAttributeNames);
        if (type === IndexType.BITMAP) {
            let uniqueKey = config.bitmapIndexOptions?.uniqueKey;
            const uniqueKeyTransformation = config.bitmapIndexOptions?.uniqueKeyTransformation;

            this.validateAttribute(config.name, uniqueKey);
            if (normalizedConfig.bitmapIndexOptions) {
                if (uniqueKey !== undefined) {
                    uniqueKey = this.canonicalizeAttribute(uniqueKey);
                    normalizedConfig.bitmapIndexOptions.uniqueKey = uniqueKey;
                }
                if (uniqueKeyTransformation !== undefined) {
                    normalizedConfig.bitmapIndexOptions.uniqueKeyTransformation = uniqueKeyTransformation;
                }
            }


        }
        return normalizedConfig;
    }

    /**
     * Validate attribute name.
     *
     * @param indexName Index name.
     * @param attributeName Attribute name.
     */
    static validateAttribute(indexName: string | undefined, attributeName: string | undefined): void {
        if (attributeName === undefined) {
            throw new TypeError('Attribute name cannot be undefined: ' + indexName);
        }
        const attributeName0 = attributeName.trim();
        if (attributeName0.length === 0) {
            throw new TypeError('Attribute name cannot be empty: ' + indexName);
        }
        if (attributeName0.endsWith('.')) {
            throw new TypeError('Attribute name cannot end with dot [config= ' + indexName
                + ', attribute=' + attributeName + ']');
        }
    }

    /**
     * Produces canonical attribute representation by stripping an unnecessary
     * "this." qualifier from the passed attribute, if any.
     *
     * @param attribute the attribute to canonicalize.
     * @return the canonical attribute representation.
     */
    static canonicalizeAttribute(attribute: string): string {
        return attribute.replace(THIS_PATTERN, '');
    }

    private static buildNormalizedConfig(mapName: string,
                                         indexType: IndexType,
                                         indexName: string | undefined,
                                         normalizedAttributeNames: string[]): InternalIndexConfig {
        const newConfig = new InternalIndexConfig();
        newConfig.bitmapIndexOptions = new InternalBitmapIndexOptions();
        newConfig.type = indexType;

        // TODO: Check logic here
        let name = indexName === undefined ? mapName + '_' + this.indexTypeToName(indexType) : undefined;
        for (const normalizedAttributeName of normalizedAttributeNames) {
            this.validateAttribute(indexName, normalizedAttributeName)
            newConfig.attributes.push(normalizedAttributeName);
            if (name != undefined) {
                name += '_' + normalizedAttributeName;
            }
        }

        if (name !== undefined) {
            indexName = name;
        }

        newConfig.name = indexName;

        return newConfig;
    }

    private static indexTypeToName(indexType: IndexType): string {
        switch (indexType) {
            case IndexType.SORTED:
                return 'sorted';
            case IndexType.HASH:
                return 'hash';
            case IndexType.BITMAP:
                return 'bitmap';
            default:
                throw new TypeError('Unsupported index type: ' + indexType);
        }
    }

}
