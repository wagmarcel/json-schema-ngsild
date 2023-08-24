const fs = require('fs');
const Ajv = require('ajv');
const yargs = require('yargs');

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
  .argv;

const ajv = new Ajv({"strict": false, "strictTypes": false, "strictSchema": false, "strictTuples": false});

var dir = argv['s']
// Read all schema files from the local directory with names like "schema?.json"
const schemaFiles = fs.readdirSync(__dirname + '/' + dir).filter(file => file.startsWith('schema') && file.endsWith('.json'));

//Load and compile all schemas
schemaFiles.forEach(schemaFile => {
  const schema = JSON.parse(fs.readFileSync(dir + '/' + schemaFile, 'utf8'));
  ajv.addSchema(schema);
});

const data = JSON.parse(fs.readFileSync(argv['d'], 'utf8'));
if (ajv.validate(argv['i'], data)) {
  console.log("The Datafile is compliant with Schema")
} else {
  console.log("Not Compliant:")
  console.log(ajv.errors)
}