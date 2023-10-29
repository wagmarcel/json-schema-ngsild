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

const $RefParser = require('json-schema-ref-parser');
var $rdf = require('rdflib');
const fs = require('fs')
const yargs = require('yargs')
const path = require('path')
const N3 = require('n3');
const url = require('url');
const { DataFactory } = N3;
const { namedNode, literal, blankNode, defaultGraph, quad } = DataFactory;
const { URL } = require('url'); // Import the URL module
const ContextParser = require('jsonld-context-parser').ContextParser;
const ContextUtil = require('jsonld-context-parser').Util;
const myParser = new ContextParser();
const jsonld = require('jsonld');

const RDF = $rdf.Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
const SHACL = $rdf.Namespace('http://www.w3.org/ns/shacl#');
const IFFK = $rdf.Namespace('https://industry-fusion.org/knowledge/v0.1/');
const argv = yargs
  .usage('Usage: $0 <json-file> [options]')
  .option('compacted', {
    alias: 'm',
    description: 'Create compacted form (without switch: expanded form)',
    demandOption: false,
    type: 'string'
  })
  .option('concise', {
    alias: 'n',
    description: 'Create concise from (without switch: normalized form) ',
    demandOption: false,
    type: 'string'
  })
  .option('context', {
    alias: 'c',
    description: 'JSON-LD-Context',
    demandOption: false,
    type: 'string'
  })
  .help()
  .alias('help', 'h')
  .argv


const jsonFileName = argv['_'][0];
const jsonText = fs.readFileSync(jsonFileName, 'utf8');
const jsonObj = JSON.parse(jsonText);


function assertNoContext(jsonObj) {
    if (Array.isArray(jsonObj)) {
        jsonObj.forEach((obj) => {
            if ("@context" in obj) {
                console.error("Error: @contex found in json-object. Only fully expanded objects without @context can be compacted. Exiting!");
                process.exit(1);
            }            
        })
    } else {
        if ("@context" in jsonObj) {
            console.error("Error: @context found in json-object. Only fully expanded objects without @context can be compacted. Exiting!");
            process.exit(1);
        }
    }
}

(async (file) => {
    if (! (argv.m === undefined)) {
        if (argv.c === undefined) {
            console.error("Error: Context must be defined externally for compaction. Exiting!");
            process.exit(1);
        }
        assertNoContext(jsonObj)

        const compacted = await jsonld.compact(jsonObj, argv.c);
        console.log(JSON.stringify(compacted, null, 2));
    } else {
        if (argv.c !== undefined) {
            console.warn("Warning: Context must not be defined externally for expansion. Ignoring external context!");
        }
        if (!("@context" in jsonObj)) {
            console.error("Error: Context must be defined internally for expansion. Exiting!");
            process.exit(1);
        }
        const expanded = await jsonld.expand(jsonObj);
        console.log(JSON.stringify(expanded, null, 2));
    
    }

 })(jsonFileName)