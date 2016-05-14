var displayRunner = (function () {
    'use strict';
    
    function runAndReturn (fxn){
        var output = '';
        
        try {
            output = fxn();
        } catch (e) {
            console.log(e);
            output = 'Error: ' + e.message;
        }
        
        return output;
    }
    
    function writeTo (id){
        var logElement = document.getElementById(id);
        logElement.innerHTML = '';
        
        return function (output) {
            var preparedOutput = typeof output === 'string' ? output : JSON.stringify(output);
            var formattedOutput = preparedOutput.replace(/\</g, '&lt;').replace(/\>/g, '&gt;');
            logElement.innerHTML += formattedOutput + '<br />';
        }
    }
    
    function displayRunner (id, fxnList){
        var writeln = writeTo(id);
        
        fxnList.forEach(function (fxn) {
            writeln(runAndReturn(fxn));
        });
    }
    
    return displayRunner;
})();