var _ = require('lodash'),
    fs = require('fs'),
    css = require('css'),
    q = require('Q');

var tabletFlags = [
        '.tablet',
        '.tablet.rd-rollover-nav2'
    ],
    desktopSheets = [
        '/input/global.min.css',
        '/input/gnglobal.min.css'
    ];

var init = function(callback) {
    var stylesheets = ['/input/tablet.min.css'].concat(desktopSheets);

    q.all(_.map(stylesheets, parseSheet)).then(function(responses) {
        combinedAst = trawlSheets(responses);
        console.log(css.stringify(combinedAst));
    });
};

var parseSheet = function(path) {
    var deferred = q.defer();

    fs.readFile(__dirname + path, function(err, content) {
        if (err) {
            deferred.reject(err);
        }

        var ast = css.parse(content.toString());

        deferred.resolve(ast);
    });

    return deferred.promise;
};

var trawlSheets = function(responses) {
    var tabletSheet = responses[0],
        desktopSheets = responses.slice(1),
        combinedAst = {
            type: 'stylesheet',
            stylesheet: {
                rules: []
            }
        };

    _.forEach(responses, function(item) {
        _.forEach(item.stylesheet.rules, function(rule) {
            combinedAst.stylesheet.rules.push(rule);
        });
    });

    _.forEach(tabletSheet, function(tItem) {

        if (tItem.rules) {

            _.forEach(tItem.rules, function(tNode) {

                var tSelectors = tNode.selectors,
                    tDeclarations = tNode.declarations;

                if (tNode.type === 'rule') {

                    _.forEach(tSelectors, function(tSelector) {

                        var foundMatchingSelector = false;

                        _.forEach(tabletFlags, function(flag) {
                            tSelector = tSelector.replace(flag + ' ', '');
                        });

                        _.forEach(desktopSheets, function(desktopSheet) {

                            _.forEach(desktopSheet, function(dItem) {

                                if (dItem.rules) {

                                    _.forEach(dItem.rules, function(dNode) {

                                        var dSelectors = dNode.selectors,
                                            dDeclarations = dNode.declarations;

                                        if (dNode.type === 'rule') {

                                            _.forEach(dSelectors, function(dSelector) {

                                                if (tSelector === dSelector) {

                                                    foundMatchingSelector = true;

                                                    // Now that we have a selector match, find any identical declarations
                                                    _.forEach(tDeclarations, function(tDeclaration) {

                                                        if (tDeclaration.type === 'declaration') {

                                                            var tProperty = tDeclaration.property;

                                                            _.forEach(dDeclarations, function(dDeclaration) {

                                                                if (dDeclaration && dDeclaration.type === 'declaration') {

                                                                    var dProperty = dDeclaration.property;

                                                                    if (dProperty === tProperty) {

                                                                        // Duplicate declaration found -- look it up in the combined AST
                                                                        var rule = _.find(combinedAst.stylesheet.rules, function(rule) {
                                                                            return (rule.position.start.line === dNode.position.start.line && rule.position.start.column === dNode.position.start.column && rule.selectors === dNode.selectors);
                                                                        });

                                                                        // Remove property declaration
                                                                        _.remove(rule.declarations, function(declaration) {
                                                                            return (declaration.property === dProperty);
                                                                        });

                                                                        if (rule.declarations.length === 0) {
                                                                            // This rule is now empty -- take it out
                                                                            _.pull(combinedAst.stylesheet.rules, rule);
                                                                        }

                                                                    }
                                                                }
                                                            });
                                                        }
                                                    });
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        });
                    });
                }
            });
        }
    });

    return combinedAst;

};

init();
