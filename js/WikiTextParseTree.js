/*\
title: js/WikiTextParseTree.js

A container for the parse tree generated by parsing wikitext

\*/
(function(){

/*jslint node: true */
"use strict";

var ArgParser = require("./ArgParser.js").ArgParser,
	utils = require("./Utils.js");

// Intialise the parse tree object
var WikiTextParseTree = function(tree,store) {
	this.tree = tree;
	this.store = store;
};

// Compile the parse tree into a JavaScript function that returns the required
// representation of the tree
WikiTextParseTree.prototype.compile = function(type,treenode) {
	treenode = treenode || this.tree;
	this.output = [];
	if(type === "text/html") {
		this.compileSubTreeHtml(treenode);
	} else if(type === "text/plain") {
		this.compileSubTreePlain(treenode);
	} else {
		return null;
	}
	// And then wrap the javascript tree and render it back into JavaScript code
	var parseTree = this.store.jsParser.createTree(
		[
			{
				type: "Function",
				name: null,
				params: ["tiddler","store","utils"],
				elements: [
					{
					type: "ReturnStatement",
					value: {
						type: "FunctionCall",
						name: {
							type: "PropertyAccess",
							base: {
								type: "ArrayLiteral",
								elements: this.output
							},
							name: "join"
						},
						"arguments": [ {
							type: "StringLiteral",
							value: ""
							}
						]
						}
					}
				]
			}
		]);
	return parseTree.render();
};

WikiTextParseTree.prototype.pushString = function(s) {
	var last = this.output[this.output.length-1];
	if(this.output.length > 0 && last.type === "StringLiterals") {
		last.value.push(s);
	} else if (this.output.length > 0 && last.type === "StringLiteral") {
		last.type = "StringLiterals";
		last.value = [last.value,s];
	} else {
		this.output.push({type: "StringLiteral", value: s});
	}
};

WikiTextParseTree.prototype.compileMacroCall = function(type,name,params) {
	var macro = this.store.macros[name],
		p,
		n;
	if(macro) {
		var macroCall = {
			type: "FunctionCall",
			name: {
				type: "Function",
				name: null,
				params: ["params"],
				elements: []},
			"arguments": [ {
				type: "ObjectLiteral",
				properties: []	
			}]
		};
		macroCall.name.elements = macro.code[type].tree.elements;
		for(p in params) {
			if(params[p].type === "string") {
				n = {type: "StringLiteral", value: params[p].value};
			} else {
				n = this.store.jsParser.parse(params[p].value).tree.elements[0];
			}
			macroCall["arguments"][0].properties.push({
				type: "PropertyAssignment",
				name: p,
				value: n
			});
		}
		this.output.push(macroCall);
	} else {
		this.pushString("<span class='error errorUnknownMacro'>Unknown macro '" + name + "'</span>");
	}
};

WikiTextParseTree.prototype.compileElementHtml = function(element, options) {
	options = options || {};
	var tagBits = [element.type];
	if(element.attributes) {
		for(var a in element.attributes) {
			var r = element.attributes[a];
			if(a === "style") {
				var s = [];
				for(var t in r) {
					s.push(t + ":" + r[t] + ";");
				}
				r = s.join("");
			}
			tagBits.push(a + "=\"" + utils.htmlEncode(r) + "\"");
		}
	}
	this.pushString("<" + tagBits.join(" ") + (options.selfClosing ? " /" : ""));
	if(options.insertAfterAttributes) {
		this.output.push(options.insertAfterAttributes);
	}
	this.pushString(">");
	if(!options.selfClosing) {
		if(element.children) {
			this.compileSubTreeHtml(element.children);
		}
		this.pushString("</" + element.type + ">");
	}
};

WikiTextParseTree.prototype.compileSubTreeHtml = function(tree) {
	for(var t=0; t<tree.length; t++) {
		switch(tree[t].type) {
			case "text":
				this.pushString(utils.htmlEncode(tree[t].value));
				break;
			case "entity":
				this.pushString(tree[t].value);
				break;
			case "br":
			case "img":
				this.compileElementHtml(tree[t],{selfClosing: true}); // Self closing elements
				break;
			case "context":
				//compileSubTree(tree[t].children);
				break;
			case "macro":
				this.compileMacroCall("text/html",tree[t].name,tree[t].params);
				break;
			case "a":
				this.compileElementHtml(tree[t],{
					insertAfterAttributes: {
						"type": "FunctionCall",
						"name": {
							"type": "PropertyAccess",
							"base": {
								"type": "Variable",
								"name": "store"},
							"name": "classesForLink"},
						"arguments":[{
							"type": "StringLiteral",
							"value": tree[t].attributes.href}]}
				});
				break;
			default:
				this.compileElementHtml(tree[t]);
				break;
		}
	}
};

WikiTextParseTree.prototype.compileElementPlain = function(element, options) {
	options = options || {};
	if(!options.selfClosing) {
		if(element.children) {
			this.compileSubTreePlain(element.children);
		}
	}
};

WikiTextParseTree.prototype.compileSubTreePlain = function(tree) {
	for(var t=0; t<tree.length; t++) {
		switch(tree[t].type) {
			case "text":
				this.pushString(utils.htmlEncode(tree[t].value));
				break;
			case "entity":
				var c = utils.entityDecode(tree[t].value);
				if(c) {
					this.pushString(c);
				} else {
					this.pushString(tree[t].value);
				}
				break;
			case "br":
			case "img":
				this.compileElementPlain(tree[t],{selfClosing: true}); // Self closing elements
				break;
			case "context":
				//compileSubTree(tree[t].children);
				break;
			case "macro":
				this.compileMacroCall("text/plain",tree[t].name,tree[t].params);
				break;
			default:
				this.compileElementPlain(tree[t]);
				break;
		}
	}
};

exports.WikiTextParseTree = WikiTextParseTree;

})();
