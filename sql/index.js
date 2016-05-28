'use strict';

var QueryFile = require('pg-promise').QueryFile;

// Helper for linking to external query files;
function sql(file) {
    var path = './sql/' + file;
    return new QueryFile(path, {minify: true});
}

module.exports = {
    init: sql('init.sql'),
    main: sql('main.sql')
};
