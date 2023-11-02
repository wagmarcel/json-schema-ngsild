/**
* Copyright (c) 2023 Intel Corporation
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*    http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
'use strict'

const fs = require('fs')
const Ajv = require('ajv')
const yargs = require('yargs')
const path = require('path')

const argv = yargs
  .option('schema-dir', {
    alias: 's',
    description: 'Schema-Directory',
    demandOption: true,
    type: 'string'
  })
  .option('datafile', {
    alias: 'd',
    description: 'File to validate',
    demandOption: true,
    type: 'string'
  })
  .option('schemaid', {
    alias: 'i',
    description: 'Schma-id to validate',
    demandOption: true,
    type: 'string'
  })
  .help()
  .alias('help', 'h')
  .argv

const ajv = new Ajv({strict: false, strictTypes: false, strictSchema: false, strictTuples: false})

const dir = argv.s
// Read all schema files from the local directory with names like "schema?.json"
const schemaFiles = fs.readdirSync(path.join(__dirname, dir)).filter(file => file.startsWith('schema') && file.endsWith('.json'))

// Load and compile all schemas
schemaFiles.forEach(schemaFile => {
  const schema = JSON.parse(fs.readFileSync(path.join(dir, schemaFile)))
  ajv.addSchema(schema)
})

const data = JSON.parse(fs.readFileSync(argv.d, 'utf8'))
if (ajv.validate(argv.i, data)) {
  console.log('The Datafile is compliant with Schema')
} else {
  console.log('Not Compliant:')
  console.log(ajv.errors)
};
