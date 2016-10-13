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
var ds = docs.structure;
var aliasCache = {} as { string : [ts2json.DocEntry]};

function getItem(item: string): ts2json.DocEntry {
    let d: ts2json.DocEntry;

    let parts: string[] =  item.split('.');
    let alias: string = parts[0];
    let stmt: string = 'doc.' + docs.aliases[alias];

    if (!aliasCache[alias]) {
        aliasCache[alias] = eval(stmt);
    }

    d = aliasCache[alias];

    if (!d) {
        console.error('Could not evaluate: ' + item + '(' + stmt + ')');
    }

    return d;
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
for (var secName in ds) {
    writeLine();
    writeLine('### ' + secName + ' <a href="#' + anchorName(secName) + '">(v)</a>');
    writeLine();

    var sec = ds[secName];
    var docLabels: string[] = sec.Document as string[];
    docLabels.forEach((docItem: string) => {
        var item: ts2json.DocEntry  = getItem(docItem);

        if (item) {
            let idxTitle = docItem.substring(docItem.indexOf('.') + 1); 
            writeLine('<a href="#' + anchorName(docItem) + '">' + idxTitle + '</a><br/>');           
        }
    })
}
