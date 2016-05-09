'use strict';

var utils = require('./utils');

function vectorAdd(v1, v2) {
    return [
        v1[0] + v2[0],
        v1[1] + v2[1],
        v1[2] + v2[2]
    ];
}

console.log(vectorAdd([1, 2, 3], [4, 5, 6]));
console.log(vectorAdd([1, 2, 3, 4], [5, 6, 7]));
console.log(vectorAdd('foo', 'bar'));