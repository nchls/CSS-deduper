var _ = require('lodash'),
    fs = require('fs'),
    css = require('css'),
    q = require('Q');

var tabletFlags = [
        '.tablet',
        '.rd-responsive-page'
    ],
    tabletFlagsLength = tabletFlags.length,
    desktopSheets = [
        '/input/global.min.css',
        '/input/gnglobal.min.css'
    ];

var init = function(callback) {
    var stylesheets = ['/input/tablet.min.css'].concat(desktopSheets);

    q.all(_.map(stylesheets, parseSheet)).then(trawlSheets);
};

var parseSheet = function(path) {
    var deferred = q.defer();

    fs.readFile(__dirname + path, function(err, content) {
        if (err) {
            deferred.reject(err);
        }

        var output = [],
            ast = css.parse(content.toString());

        _.forEach(ast, function(item) {
            if (item.rules) {
                _.forEach(item.rules, function(node) {
                    if (node.type === 'rule') {
                        output.push([
                            node.selectors,
                            node.declarations
                        ]);
                    }
                });
            }
        });

        deferred.resolve(output);
    });

    return deferred.promise;
};

var trawlSheets = function(responses) {
    var tabletSheet = responses[0],
        desktopSheets = responses.slice(1),
        dSheetsLength = desktopSheets.length;

    for (var ruleIndex=0, l=tabletSheet.length; ruleIndex<l; ruleIndex++) {
        var tRule = tabletSheet[ruleIndex],
            tSelectors = tRule[0],
            tDeclarations = tRule[1];

        for (var i=0, l2=tSelectors.length; i<l2; i++) {
            var tSelector = tSelectors[i];
            for (var j=0; j<tabletFlagsLength; j++) {
                tSelector = tSelector.replace(tabletFlags[j] + ' ', '');
            }

            for (var dSheetIdx=0; dSheetIdx<dSheetsLength; dSheetIdx++) {
                var desktopSheet = desktopSheets[dSheetIdx];

                for (var j=0, l3=desktopSheet.length; j<l3; j++) {
                    var dRule = desktopSheet[j],
                        dSelectors = dRule[0],
                        dDeclarations = dRule[1];

                    for (var k=0, l4=dSelectors.length; k<l4; k++) {
                        var dSelector = dSelectors[k];
                        if (tSelector === dSelector) {

                            for (var m=0, l5=tDeclarations.length; m<l5; m++) {
                                var tDeclaration = tDeclarations[m],
                                    tProperty,
                                    tValue;
                                
                                if (tDeclaration.type === 'declaration') {
                                    tProperty = tDeclaration.property;
                                    tValue = tDeclaration.value;
                                    
                                    for (var n=0, l6=dDeclarations.length; n<l6; n++) {
                                        var dDeclaration = dDeclarations[n],
                                            dProperty,
                                            dValue;
                                    
                                        if (dDeclaration.type === 'declaration') {
                                            dProperty = dDeclaration.property;
                                            dValue = dDeclaration.value;
                                    
                                            if (dProperty === tProperty) {
                                                console.log(tSelector);
                                                console.log('\t' + dProperty + ': ' + dValue + '; is overridden by ' + tProperty + ': ' + tValue + ';');
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

init();
