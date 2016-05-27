'use strict';

var QueryFile = require('pg-promise').QueryFile;

// Helper for linking to external query files;
function sql(file) {
    var path = './sql/' + file;
    var options = {
        params: {
            schema: 'pgjson'
        },
        minify: true
    };
    return new QueryFile(path, options);
}

module.exports = {
    init: sql('init.sql'),
    main: sql('main.sql')
};
