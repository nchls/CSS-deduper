var _ = require('lodash'),
    fs = require('fs'),
    css = require('css'),
    q = require('Q');

var tabletFlags = [
        '.tablet',
        '.tablet.rd-rollover-nav',
        '.rd-responsive-page'
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
        },
        combinedAstKeys = [];

    var addNode = _.memoize(function(node) {
        var selectorsKey = node.selectors.join(',');
        if (combinedAstKeys.indexOf(selectorsKey) === -1) {
            combinedAst.stylesheet.rules.push(node);
            combinedAstKeys.push(selectorsKey);
        } else {
            var dupeRule = _.find(combinedAst.stylesheet.rules, {selectors: node.selectors});
            _.forEach(node.declarations, function(declaration) {
                var dupeDeclaration = _.find(dupeRule.declarations, {property: declaration.property});
                if (!dupeDeclaration) {
                    // Same selectors, but new property -- add it to the AST
                    dupeRule.declarations.push(declaration);
                }
            });
        }
    }, JSON.stringify);

    _.forEach(tabletSheet, function(tItem) {

        if (tItem.rules) {

            _.forEach(tItem.rules, function(tNode) {

                var tNodeCandidate = tNode,
                    tSelectors = tNode.selectors,
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

                                        var dNodeCandidate = _.cloneDeep(dNode),
                                            dSelectors = dNode.selectors,
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

                                                                if (dDeclaration.type === 'declaration') {

                                                                    var dProperty = dDeclaration.property;

                                                                    if (dProperty === tProperty) {

                                                                        var candidateDeclaration = _.find(dNodeCandidate.declarations, {property: dProperty});
                                                                        _.pull(dNodeCandidate.declarations, candidateDeclaration);
                                                                        if (!dNodeCandidate.declarations.length) {
                                                                            dNodeCandidate = null;
                                                                        }

                                                                    }
                                                                }
                                                            });
                                                        }
                                                    });
                                                }
                                            });

                                            // Add the desktop rule after removing any tablet-overridden declarations
                                            if (dNodeCandidate) {
                                                addNode(dNodeCandidate);
                                            }

                                        }
                                    });
                                }
                            });
                        });

                        // Tablet selector was not found in desktop CSS -- so just add it to the combined
                        if (!foundMatchingSelector) {
                            addNode(tNodeCandidate);
                        }

                        desktopPassCompleted = true;

                    }); 
                }
            });
        }
    });

    return combinedAst;

};

init();
