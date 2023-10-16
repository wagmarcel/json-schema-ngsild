# Schema Review

## Build and run validation tool

### Build

```
npm install
```

### Run

```
node validate.js  -s <SCHEMA-DIR> -d <DATA-TO-VALIDATE> -i <ID-TO-VALIDATE>
```

* SCHEMA-DIR: Directory containing files starting with `schema` and ending with `.json`
* DATA-TO-VALIDATE: file containing the JSON data to be validated by the Schema
* ID-TO-Validate: String with id of root-Schema

example:

```
node validate.js  -s schema3 -d payload.json -i '/sensor/v0.1/sensor.json'
```


# Review of provided [JSON-Schema](./sensor-schema-orig.json)

1. "$id" and "$ref": URLs should be relative or absolute. But here the $ids are defined relative but are refernced absolute. Example: Object with ``"$id": "sensor/v0.1/sensor"`` does reference `sensor/v0.1/sensor-metadata.json` which should resolve to `sensor/v0.1/sensor/sensor/v0.1/sensor-metadata.json` which is not intended here because only `sensor/v0.1/sensor-metadata.json` exists.

    Solution: Move Ids and references to absolute values and remove .json postfix, i.e. ``"$id": "sensor/v0.1/sensor"`` and `"$ref": "sensor/v0.1/sensor-metadata"`. This allows better referencing and clearer referencing of subitems.
2. "id" fields (without "$") are creating validation errors. Not clear what the purpose is of this id field, but moved it to "$id"
3. On high level there is nothing mandatory. so '{}' would be conforming to this schema as well. Is this intended?
4. There are some type mismatches, e.g. why is '/base-objects/v0.1/machine-identification/properties/asset_communication_protocol' an array and not a string? Or `ce_marking` is defined as `object` with `base64` encoing, at least for me this didn't validate.
4. The defined hierarchy is not really a great fit to the entity/relationship model of NGIS-LD. Remember in NGSI-LD you can have 2 types of content: Relationships and Properties. Properties can be JSON-primitive-types and JSON-Objects. If you have something which does not have any relevance for the live system, e.g. identification, it can be put into a common JSON-object. If you have data which should be monitored or changed, it is adviced to have data, which is relevant for operations as JSON-primitives. 
5. What is the purpose of "operation_conditions"? Is it static information that is fixed for every machine type? Then I guess we do not need to manage it in every JSON-object of that machine typ? Is it different for every machine? Then we need to define a relationship to a measurement device and a SHACL constraint to monitor this. Also, the field name seem to implicitly define relationship for instance the field `ambient_operating_temperature` seems to be related to `ambient_operating_temperature_min` and `ambient_operating_temperature_max` but there is no formal way, except string matching to see the relationship. In general, we have either reference it, e.g. "reference": "/base-objects/v0.1/operation-conditions-runtime/base-objects-v0.1-operation-conditions-runtime-ambient-operating-temperature" or one can put the constraints directly into the field, e.g. use `maximum` and `minimum` field int the `ambient_operating_temperature` description.
6. No namespace prefixes described, how to derive namespaces?
7. default values vs enum. e.g. 'machine_state' why is it default array (which means take whole array of all values if it is not defined) and not enum of possible values (which defines allowed valued)

The corrected schema and an example payload can be found [here](./schma-orig-fixed). It can be validated by


```
node validate.js -s schema-orig-fixed -d schema-orig-fixed/payload.json -i /sensor/v0.1/sensor
```

## Change Proposals for flattening the hierarchy of [JSON-LD](./schema-orig-fixed-ngsild):

From the analysis above, the following change proposals can be derived:

1. Change the naming scheme to absolute URLs and remove the ".json" postfix.
2. Rename the "id" fields in the operational data to "$id" fields. (or remove it if you do not need it)
3. Flatten the hirarchy. Only static/read-only data should be JSON-object data, the rest should be JSON-primitives
4. Use JSON-Schema constraint fields to define constraints for the respective fields. E.g. `maximum` and `minimum` for the operational values
5. make the "metadata" and `sensor-data` fields mandatory.
6. Add default namespace to metadata

## Change Proposals for creating compliant [NGSI-LD](./schema-with-relationships):

NGSI-LD has stricter requirements than JSON-LD. It must have an `id` and `type` field and all other attributes can be Properties or Relationships. The property names are prefixed with the respective namespace:

```
{
    "https://www.industry-fusion.org/properties/v0.1/machine_state": {
    "type": "Property",
    "value": "Testing"
    },
    "https://www.industry-fusion.org/properties/v0.1/hasFilter": {
        "type": "Relationship"
        "object": "urn:filter:1"
    },
    "id": "urn:x:1",
    "type": "https://www.industry-fusion.org/types/v0.1/cutter"
}
```

NGSI-LD v1.6 provides 3 different forms:

1. Normalized Form
2. Simplified Form
3. Concise Form

The NGSI-LD object above is already an example for the **Normalized Form**. The  **Simplified Form** reduces all attributes to key-value pairs like so:

```
{
    "https://www.industry-fusion.org/properties/v0.1/machine_state": "Testing",
    "https://www.industry-fusion.org/properties/v0.1/hasFilter": "urn:filter:1",
    "id": "urn:x:1",
    "type": "https://www.industry-fusion.org/types/v0.1/cutter"
}
```

This representation is not lossless, e.g. the differentiation whether an attribute is a Property and a Relationship is lost. Therefore NGSI-LD 1.6 defines a third form, the **Concise Form** which eliminates the redunancy of the **Normalized Form** but does not lose information:

```
{
    "https://www.industry-fusion.org/properties/v0.1/machine_state": "Testing",
    "https://www.industry-fusion.org/properties/v0.1/hasFilter": {
        "object": "urn:filter:1"
    },
    "id": "urn:x:1",
    "type": "https://www.industry-fusion.org/types/v0.1/cutter"
}
```

Apparently, to identify a Relationship, the `object` key is sufficient. 

Finally, with help of standard JSON-LD contexts, the namespace prefixes can be managed:

```
{
    "@context": [
        "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld",
        {
            "@vocab": "https://www.industry-fusion.org/properties/v0.1/"
        }
    ],
    "machine_state": "Testing",
    "hasFilter": {
        "object": "urn:filter:1"
    },
    "id": "urn:x:1",
    "type": "https://www.industry-fusion.org/types/v0.1/cutter"
}
```

The **Concise Form** of NGSI-LD can easy be validated with JSON-Schema, when the `context` is ignored, as shown [here](./schema-with-relationships).

This can be validated by

```
node validate.js -s schema-with-relationships -d schema-with-relationships payload.json -i https://www.industry-fusion.org/types/v0.1/cutter
```


## Minimalized Schema for NGSI-LD (excluding GUI elements)

```
node validate.js -s schema-ngsild-minimal -d schema-ngsild-minimal/payload.json -i "https://www.industry-fusion.org/types/v0.1/cutter"
```

## E-class integration

ECLASS uses IRDI's to identify types and properties. An IRDI is structured as follows:

```
RAI#DI#VI
```

- RAI is the registration authroity identifier
- DI is the Data identifier
- VI is the Version indentifier

Examples for ECLASS IRDI'S:

```
0173-1#02-BAH754#006
0173-1#01-AKJ975#017
0173-1#02-AAH880#003
```

Mapping IRDI's to IRI's is not straight forward. IRDI's do not have an explicit prefix to identify the scheme like IRI's (e.g. "http", "urn")
Therefore, IFF needs to agree on a mapping scheme. One obvious mapping scheme is to wrap the IRDI into an IRI like so:

```
https://www.industry-fusion.org/eclass/0173-1#02-AAH880#003
```

With such a mapping the eclass identifiers can be mapped to NGSI-LD objects by extending the `@context` by an `eclass` prefix:

```
  "@context": [
        "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld",
        {
            "@vocab": "https://www.industry-fusion.org/properties/v0.1/",
            "eclass": {
                "@id": "https://www.industry-fusion.org/eclass/",
                "@prefix": true
            }
        }
    ]
```


Given the `@context`, the object containing `eclass` and normal fields can be described as follows:
```
{
    "machine_state": "Testing",
    "hasFilter": {
        "object": "urn:filter:1"
    },
    "eclass:0173-1#02-AAH880#003": "10",
    "id": "urn:x:1",
    "type": "eclass:0173-1#01-AKJ975#017"
}
```

The expanded `JSON-LD` object looks like:

```
[
  {
    "https://www.industry-fusion.org/eclass/0173-1#02-AAH880#003": [
      {
        "@value": "10"
      }
    ],
    "https://www.industry-fusion.org/properties/v0.1/hasFilter": [
      {
        "https://uri.etsi.org/ngsi-ld/hasObject": [
          {
            "@id": "urn:filter:1"
          }
        ]
      }
    ],
    "@id": "urn:x:1",
    "https://www.industry-fusion.org/properties/v0.1/machine_state": [
      {
        "@value": "Testing"
      }
    ],
    "@type": [
      "https://www.industry-fusion.org/eclass/0173-1#01-AKJ975#017"
    ]
  }
]
```