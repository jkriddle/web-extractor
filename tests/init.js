process.env.NODE_ENV = 'test';

var fs = require('fs'),
	Mocha = require("mocha"),
	path = require('path'),
	connect = require('connect');
	serveStatic = require('serve-static');

// Our Mocha runner
var mocha = new Mocha({
	ui:"bdd",
	reporter:"spec",
	timeout:5000,
	slow:10000
});
 
// Files which need to be ignored
var avoided = [
	"node_modules",
	"config",
	"data"
];
 
// Add the tests to the Mocha instance
(addFiles = function(dir){
	fs.readdirSync(dir).filter(function(file){
		if(!~avoided.indexOf(file)){
			if(fs.statSync(dir + '/' + file).isDirectory()){
				addFiles(dir + '/' + file);
			}
			return file.substr(-3) === '.js';
		}
	}).forEach(function(file){
		mocha.addFile(dir + '/' + file);
	});
})(path.join(process.cwd(), process.argv[2] || "."));

 
function runTests() {
	mocha.run(function(failures){
		process.exit(failures);
	});
};

// Fire up server for local testing (we don't want to hit a live site with huge amounts of testing traffic)
connect().use(serveStatic(__dirname)).listen(8181, function() {
	runTests();
});
