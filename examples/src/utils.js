'use strict';

function isArray(value) {
    return value instanceof Array;
}

function isTypeOf(typeStr) {
    return function (value) {
        return typeof value === typeStr;
    };
}

function throwOnTypeMismatch(typeStr) {
    var typeCheck = typeStr === 'array' ? isArray : isTypeOf(typeStr);

    return function (value) {
        if (!typeCheck(value)) {
            throw new Error('Expected type ' + typeStr + ' but got ' + typeof value);
        }
    };
}

function catchWrapper (throwsFn){
    return function () {
        var args = Array.prototype.slice.call(arguments);
        
        try{
            return throwsFn.apply(null, args);
        } catch (e) {
            return e.message;
        }
    }
}

module.exports = {
    throwOnTypeMismatch: throwOnTypeMismatch,
    catchWrapper: catchWrapper
};