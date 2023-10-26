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
const fs = require('fs')
const yargs = require('yargs')
const path = require('path')
const N3 = require('n3');
const { DataFactory } = N3;
const { namedNode, literal, blankNode, defaultGraph, quad } = DataFactory;
const { URL } = require('url'); // Import the URL module
const ContextParser = require('jsonld-context-parser').ContextParser;
const ContextUtil = require('jsonld-context-parser').Util;
const myParser = new ContextParser();


const rdf_ns = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
const iffk_ns = "https://industry-fusion.org/knowledge/v0.1/"
const shacl_ns = "http://www.w3.org/ns/shacl#"
const rdf_type = namedNode(rdf_ns + 'type');
const shacl_in = namedNode(shacl_ns +'in');
const shacl_Literal = namedNode(shacl_ns +'Literal');
const shacl_IRI = namedNode(shacl_ns +'IRI');
const shacl_BlankNode = namedNode(shacl_ns +'BlankNode');
const shacl_datatype = namedNode(shacl_ns +'datatype');
const shacl_class = namedNode(shacl_ns +'class');
const shacl_nodeKind = namedNode(shacl_ns +'nodeKind');
const shacl_NodeShape = namedNode(shacl_ns +'NodeShape');
const shacl_maxInclusive = namedNode(shacl_ns +'maxInclusive');
const shacl_minInclusive = namedNode(shacl_ns +'minInclusive');
const shacl_maxExclusive = namedNode(shacl_ns +'maxExclusive');
const shacl_minExclusive = namedNode(shacl_ns +'minExclusive');
const shacl_targetClass = namedNode(shacl_ns +'targetClass');
const argv = yargs
  .command('$0', 'Converting an IFF Schema file for NGSI-LD objects into a SHACL constraint.')
  .option('schema', {
    alias: 's',
    description: 'Schema File containing array of Schemas',
    demandOption: true,
    type: 'string'
  })
  .option('schemaid', {
    alias: 'i',
    description: 'Schma-id of object to generate SHACL for',
    demandOption: true,
    type: 'string'
  })
  .option('context', {
    alias: 'c',
    description: 'JSON-LD-Context',
    demandOption: true,
    type: 'string'
  })
  .help()
  .alias('help', 'h')
  .argv

// Read in an array of JSON-Schemas
const jsonSchemaText = fs.readFileSync(argv.s, 'utf8');
const jsonSchema = JSON.parse(jsonSchemaText);
var global_context;


class NodeShape {
    constructor(targetClass) {
        this.targetClass = targetClass;
        this.properties = [];
    }
    addPropertyShape(propertyShape){
        this.properties.push(propertyShape)
    }
}


class PropertyShape {
    constructor(mincount, maxcount, nodeKind, path) {
        this.mincount = mincount;
        this.maxcount = maxcount;
        this.nodeKind = nodeKind;
        this.path = path;
        this.constraints = [];
    }
    addConstraint(constraint){
        this.constraints.push(constraint)
    }
}

class Constraint {
    constructor(type, params){
        this.type = type;
        this.params = params
    }
}


function scanNodeShape(typeschema) {
    const id = typeschema["$id"];
    
    var nodeShape = new NodeShape(id);
    scanProperties(nodeShape, typeschema)
    return nodeShape;
}


function scanProperties(nodeShape, typeschema) {
    var required = [];
    if ("required" in typeschema) {
        required = typeschema["required"]
    }
    if ("properties" in typeschema) {
        Object.keys(typeschema.properties).forEach(
            (property) => {
                if (property == 'type'){
                    return
                }
                var nodeKind = shacl_Literal;
                var klass = null;
                if ("relationship" in typeschema.properties[property]){
                    nodeKind = shacl_IRI;
                    klass = property.relationship;
                }
                var mincount = 0
                var maxcount = 1
                if (required.includes(property)) {
                    mincount = 1;
                }
                var path = property;
                if (path.indexOf(':') == -1) {
                    path = ':' + path;
                }
                var propertyShape = new PropertyShape(mincount, maxcount, nodeKind, path);
                nodeShape.addPropertyShape(propertyShape);
                if (klass !== null) {
                    propertyShape.addConstraint(new Constraint(shacl_class, klass))
                }
                scanConstraints(propertyShape, typeschema.properties[property])
            })
    }
    if ("allOf" in typeschema) {
        typeschema.allOf.forEach((elem) => {
            scanProperties(nodeShape, elem)
        })
    }
}


function scanConstraints(propertyShape, typeschema){
    if ("enum" in typeschema) {
        propertyShape.addConstraint(new Constraint(shacl_in, typeschema.enum))
    }
    if ("datatype" in typeschema){
        propertyShape.addConstraint(new Constraint(shacl_datatype, typeschema.datatype))
    }
    if ("maxiumum" in typeschema){
        propertyShape.addConstraint(new Constraint(shacl_maxInclusive, typeschema.maximum))
    }
    if ("miniumum" in typeschema){
        propertyShape.addConstraint(new Constraint(shacl_minInclusive, typeschema.minimum))
    }
    if ("exclusiveMiniumum" in typeschema){
        propertyShape.addConstraint(new Constraint(shacl_minExclusive, typeschema.exclusiveMinimum))
    }
    if ("exclusiveMaxiumum" in typeschema){
        propertyShape.addConstraint(new Constraint(shacl_maxExclusive, typeschema.exclusiveMaximum))
    }
    if ("maxLength" in typeschema){
        propertyShape.addConstraint(new Constraint(shacl_maxLength, typeschema.maxLength))
    }
    if ("minLength" in typeschema){
        propertyShape.addConstraint(new Constraint(shacl_minLength, typeschema.minLength))
    }
}


function dumpShacl(nodeShape, writer){
    dumpNodeShape(nodeShape, writer)
}


function dumpNodeShape(nodeShape, writer){
    var nodeName = global_context.expandTerm(nodeShape.targetClass);
    writer.addQuad(namedNode(nodeName), rdf_type, shacl_NodeShape);
    writer.addQuad(namedNode(nodeName), shacl_targetClass, namedNode(nodeName));
}


function shaclize(schemas, id) {
    const writer = new N3.Writer({ prefixes: { c: 'http://example.org/cartoons#',
                                       foaf: 'http://xmlns.com/foaf/0.1/' } });
    const typeschema = schemas.find((schema) => schema.$id == id)
    //console.log("typeschema" + JSON.stringify(typeschema))
    //find all properties
    var nodeShape = scanNodeShape(typeschema)

    dumpShacl(nodeShape, writer)
}


async function loadContext(filename) {
    const contextFile = JSON.parse(fs.readFileSync(filename, 'utf-8'));
    const context = await myParser.parse(contextFile);
    global_context = context;
    const prefix_hash = {}
    Object.keys(context.getContextRaw()).forEach((key) => {
        const value = context.getContextRaw()[key]
        if (typeof value === "string"){
            if (ContextUtil.isPrefixIriEndingWithGenDelim(value)) {
                prefix_hash[key] = value;
            }
        }
        else if (typeof value === "object") {
            if (ContextUtil.isPrefixIriEndingWithGenDelim(value['@id'])) {
                prefix_hash[key] = value['@id'];
            }
        }
    })
    return;
}


(async (jsconSchema) => {
    let myResolver = {
        order: 1,
    
        canRead: function (file) {
            console.log("CanRead " + JSON.stringify(file));
            return true;
        },
   
        read: function (file, callback, $refs) {
    
            console.log("$ref" + JSON.stringify(file) + $refs)
            return jsonSchema.find((schema) => schema.$id == file.url)
        }
    };
    const options = {
        resolve: {
            file: false,
            http: false,
            test: myResolver
        }
    };
    console.log("hello")
    try {
        let schema = await $RefParser.dereference(jsonSchema, options);
        //console.log(JSON.stringify(schema));
        return schema;
    }
    catch (err) {
        console.error(err);
    }
})(jsonSchema)
.then(async(schema) => {await loadContext(argv.c); return schema;})
//.then((schema) => {console.log(JSON.stringify(schema)); return schema;})
.then((schema => {shaclize(schema, argv.i)}))
