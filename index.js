/**
 * Copyright (c) 2024 TYO Lab (TYONLINE TECHNOLOGY PTY. LTD.). All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 */

if (require.main === module) {
    require('./cli');
} else {
    module.exports = require('./lib');
}
