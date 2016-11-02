import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as ts2json from './TypeScriptSourceToJson'
var shell = require('shelljs');

function header(line: string) {
    console.log();
    console.log(' ===== ' + line +  ' ====');
    console.log();
}

var srcOptions = require('../tsconfig.json');
var docs = require('./docs.json');

// ensure we're generating docs using same module and target as src
let options: ts.CompilerOptions = {
    module: srcOptions['module'],
    target: srcOptions['target']
}

const jsonDocName: string = "vsts-task-lib.json";
const mdDocName: string = "vsts-task-lib2.md";

header('Generating ' + jsonDocName);
let doc: ts2json.DocEntry = ts2json.generate(docs.files, options);
fs.writeFileSync(jsonDocName, JSON.stringify(doc,null, 2));

//--------------------------------------------------------------
// Generate markdown
//--------------------------------------------------------------
header('Generating ' + mdDocName)
let mdpath = path.join(__dirname, mdDocName);

function writeLine(line?: string) {
    fs.appendFileSync(mdpath, (line || ' ') + os.EOL);
}

function anchorName(name) {
    return name.replace(/\./g, '').replace(/ /g, '');
}

shell.rm('-rf', mdpath);
var docsStructure = docs.structure;
var aliasCache = {} as { string : [ts2json.DocEntry]};

function getDocEntry(namespace: string): ts2json.DocEntry {
    let d: ts2json.DocEntry;

    let parts: string[] =  namespace.split('.');
    if (parts.length != 2) {
        console.error(namespace + ' invalid.  doc entry must have two parts.  alias.itemName');
    }

    let alias: string = parts[0];
    let entryName: string = parts[1];
    let stmt: string = 'doc.' + docs.aliases[alias];
    
    if (!aliasCache[alias]) {
        aliasCache[alias] = eval(stmt);
    }
    d = aliasCache[alias][entryName];

    if (!d) {
        console.error('Could not evaluate: ' + namespace + '(' + stmt + ')');
    }

    return d;
}

// TODO: enums
// TODO: isOptional on params
// TODO: params type

var writeFunction = function(name: string, item: ts2json.DocEntry) {
    writeLine("<br/>");
    writeLine('<div id="' + anchorName(name) + '">');
    writeLine('### ' + name + ' <a href="#index">(^)</a>');

    var sigs = item.signatures;
    sigs.forEach((sig: ts2json.DocEntry) => {
        // comments
        var comment = sig.documentation;
        if (comment) {
            writeLine(comment);
        }

        // signature

        var sigLine = item.name + '(';

        if (sig.parameters) {
            for (var i = 0; i < sig.parameters.length; i++) {
                var param = sig.parameters[i];
                sigLine += param.name;

                // if (param.flags.isOptional) {
                //     sigLine += '?';
                // }

                sigLine += (':' + param.type);

                if (i < (sig.parameters.length - 1)) {
                    sigLine += ', ';
                }
            }
        }

        sigLine += '):' + sig.return; 

        writeLine('```javascript');
        writeLine(sigLine);
        writeLine('```');

        // params table

        if (sig.parameters) {
            writeLine();
            writeLine('Param | Type | Description');
            writeLine('--- | --- | ---');
            for (var i = 0; i < sig.parameters.length; i++) {
                var param = sig.parameters[i];

                var pc = param.documentation ? param.documentation || ' - ' : ' - ';
                writeLine(param.name + ' | ' + param.type + ' | ' + pc);
            }
            writeLine();
        }                       
    });
}

writeLine('# VSTS-TASK-LIB TYPESCRIPT API');
writeLine();
writeLine('## Dependencies');
writeLine('A [cross platform agent](https://github.com/Microsoft/vso-agent) OR a TFS 2015 Update 2 Windows agent (or higher) is required to run a Node task end-to-end. However, an agent is not required for interactively testing the task.');
writeLine();
writeLine('## Importing');
writeLine('For now, the built vsts-task-lib (in _build) should be packaged with your task in a node_modules folder');
writeLine();
writeLine('The build generates a vsts-task-lib.d.ts file for use when compiling tasks');
writeLine('In the example below, it is in a folder named definitions above the tasks lib');
writeLine();
writeLine('```');
writeLine('/// <reference path="../definitions/vsts-task-lib.d.ts" />');
writeLine("import tl = require('vsts-task-lib/task')");
writeLine('```');
writeLine();
writeLine('## [Release notes](releases.md)');
writeLine();

//
// Index
//
writeLine('<div id="index">');
writeLine('## Index');
for (var sectionName in docsStructure) {
    writeLine();
    writeLine('### ' + sectionName + ' <a href="#' + anchorName(sectionName) + '">(v)</a>');
    writeLine();

    var section = docsStructure[sectionName];
    var docItems: string[] = section.Document as string[];
    docItems.forEach((docItem: string) => {
        var docEntry: ts2json.DocEntry  = getDocEntry(docItem);

        if (docEntry) {
            writeLine('<a href="#' + anchorName(docItem) + '">' + docEntry.name + '</a><br/>');           
        }
    })
}

//
// Docs
//
for (var sectionName in docsStructure) {
    writeLine();
    writeLine("<br/>");
    writeLine('<div id="' + anchorName(sectionName) + '">');
    writeLine('## ' + sectionName);
    writeLine();
    writeLine('---');
    writeLine();

    var sec = docsStructure[sectionName];
    if (sec.Summary) {
        writeLine(sec.Summary);
    }

    if (sec.Sample) {
        try {
            writeLine();
            var contents = fs.readFileSync(path.join(__dirname, sec.Sample));    
            writeLine("```javascript");
            if (!contents || contents.length == 0) {
                writeLine('No content');
            }
            writeLine(contents.toString());
            writeLine("```");
        }
        catch(err) {
            console.error(err);
        }
    }

    var documents = sec.Document;
    documents.forEach((docItem) => {
        console.log('docItem', docItem);
        var item: ts2json.DocEntry = getDocEntry(docItem);

        if (item) {
            switch (item.kind) {
                case "Constructor":
                case "method":
                //case "Enumeration":
                case "function":
                    writeFunction(docItem, item);
                    break;

                case "interface":
                    //writeInterface(doc, item);
                    break;

                default:
                    console.log('warning: skipping ' + item.kind);
                    console.log(item);
                    process.exit();
            }             
        }
    })
}

console.log('Done');

