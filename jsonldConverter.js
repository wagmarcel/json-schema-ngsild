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
//const { URL } = require('url'); // Import the URL module
const ContextParser = require('jsonld-context-parser').ContextParser;
const ContextUtil = require('jsonld-context-parser').Util;
const myParser = new ContextParser();
const jsonld = require('jsonld');
const exp = require('constants');

const RDF = $rdf.Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
const SHACL = $rdf.Namespace('http://www.w3.org/ns/shacl#');
const IFFK = $rdf.Namespace('https://industry-fusion.org/knowledge/v0.1/');
const argv = yargs
  .usage('Usage: $0 <json-file> [options]')
  .option('concise', {
    alias: 'n',
    description: 'Create concise/compacted from',
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
var jsonArr;

if (!Array.isArray(jsonObj)){
    jsonArr = [jsonObj]
} else {
    jsonArr = jsonObj
}

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


// Check if every object in array whether it has Context
function hasContexts(jsonArr) {
    jsonArr.forEach(jsonObj => {
        if (!("@context" in jsonObj)) {
            return false
        }
    })
    return true;
}


function loadContextFromFile(fileName) {
    const context = fs.readFileSync(fileName, 'utf8');
    const contextParsed = JSON.parse(context)
    return contextParsed;
}


// Merge Contexts
function mergeContexts(jsonArr, context) {
    function mergeContext(localContext, context) {
        var mergedContext = [];
        if (Array.isArray(localContext)){
            mergedContext = [localContext];
        }
        if (context === undefined) {
            if (mergedContext.length === 0) {
                return null;
            }
            return mergedContext;
        } else if (!Array.isArray(context)) {
            context = [context];
        }
        context.forEach(c => {
            if (typeof(c) !== "string" || mergedContext.find(x => c === x) === undefined) {
                mergedContext.push(c)
            }
        })
        return mergedContext; 
    }
    const parseContextUrl = url.parse(context, true);
    if (parseContextUrl.protocol === "file:"){
        context = loadContextFromFile(parseContextUrl.path);
    }
    return jsonArr.map(jsonObj => {
        const localContext = jsonObj["@context"]
        return mergeContext(localContext, context)

    })
}


function conciseExpandedForm(expanded) {
    function filterAttribute(attr) {
        if (typeof(attr) === 'object') {
            if ("@type" in attr && (attr["@type"][0] === 'https://uri.etsi.org/ngsi-ld/Property' || 
                                    attr["@type"][0] === "https://uri.etsi.org/ngsi-ld/Relationship")) {
                delete attr["@type"];
            }
            if ("https://uri.etsi.org/ngsi-ld/hasValue" in attr) {
                attr["@value"] = attr["https://uri.etsi.org/ngsi-ld/hasValue"][0]["@value"]
                delete attr["https://uri.etsi.org/ngsi-ld/hasValue"];
            }
        }
    }
    expanded.forEach(c => {
        Object.keys(c).forEach(key => {
            if (Array.isArray(c[key])) {
                c[key].forEach(a => filterAttribute(a))
            } else {
                filterAttribute(c[key])
            }
        })
    })
    return expanded;
}


async function expand(objArr, contextArr) {
    const expanded = await Promise.all(objArr.map(async(jsonObj, index) => {
        jsonObj['@context'] = contextArr[index];
        var res = await jsonld.expand(jsonObj)
        return res[0];
    }));
    return expanded;
}


async function compact(objArr, contextArr) {
    return await Promise.all(objArr.map(async(jsonObj, index) => jsonld.compact(jsonObj, contextArr[index])));
}


(async (jsonArr) => {
    if (!(argv.n === undefined)) {
        const mergedContexts = mergeContexts(jsonArr, argv.c);
        if (mergedContexts !== undefined && mergedContexts.find(x => x === null)) {
            console.error("Error: For Compaction, context must be either defined in all objects or externally. Exiting!");
            process.exit(1);
        }
        // Compaction to find Properties in compacted form
        const expanded = await expand(jsonArr, mergedContexts);
        const concised = conciseExpandedForm(expanded);
        const compacted = await compact(concised, mergedContexts);
        //const concisedAmdcompacted = await Promise.all(compacted.map(async(jsonObj, index) => jsonld.compact(jsonObj, mergedContexts[index])));
        console.log(JSON.stringify(compacted, null, 2));
    
    }

 })(jsonArr)