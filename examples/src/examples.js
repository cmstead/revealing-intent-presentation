function throwOnArrayMismatch(value) {
    if (!(value instanceof Array)) {
        throw new Error('Expected array but got ' + typeof value);
    }
}

var bareVectors = (function () {
    'use strict';

    function vectorAdd(v1, v2) {
        return [v1[0] + v2[0], v1[1] + v2[1], v1[2] + v2[2]];
    }

    return [
        vectorAdd.bind(null, [1, 2, 3], [4, 5, 6]),
        vectorAdd.bind(null, [1, 2, 3, 4], [5, 6, 7]),
        vectorAdd.bind(null, 'foo', 'bar')
    ];
})();

var simpleCheck = (function () {
    'use strict';

    function vectorAdd(v1, v2) {
        throwOnArrayMismatch(v1);
        throwOnArrayMismatch(v2);

        return [v1[0] + v2[0], v1[1] + v2[1], v1[2] + v2[2]];
    }

    return [
        vectorAdd.bind(null, [1, 2, 3], [4, 5, 6]),
        vectorAdd.bind(null, [1, 2, 3, 4], [5, 6, 7]),
        vectorAdd.bind(null, 'foo', 'bar')
    ];
})();

var signedFn = (function () {
    'use strict';

    vectorAdd.signature = '(array, array): array';

    function vectorAdd(v1, v2) {
        throwOnArrayMismatch(v1);
        throwOnArrayMismatch(v2);

        return [v1[0] + v2[0], v1[1] + v2[1], v1[2] + v2[2]];
    }

    return [
        vectorAdd.bind(null, [1, 2, 3], [4, 5, 6]),
        vectorAdd.bind(null, [1, 2, 3, 4], [5, 6, 7]),
        vectorAdd.bind(null, 'foo', 'bar'),

        (function (fn) { return fn.signature }).bind(null, vectorAdd)
    ];
})();

var signetEnforced = (function () {
    'use strict';

    var vectorAdd = signet.enforce(
        'array, array => array',
        function vectorAdd(v1, v2) {
            return [v1[0] + v2[0], v1[1] + v2[1], v1[2] + v2[2]];
        });

    return [
        vectorAdd.bind(null, [1, 2, 3], [4, 5, 6]),
        vectorAdd.bind(null, [1, 2, 3, 4], [5, 6, 7]),
        vectorAdd.bind(null, 'foo', 'bar'),

        (function (fn) { return fn.signature }).bind(null, vectorAdd)
    ];
})();