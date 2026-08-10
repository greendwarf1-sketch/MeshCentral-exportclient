'use strict';
/**********************************************************************
 * Copyright (C) 2026 Mr. Green & MCS
 * 
 * exportclient.js - DEBUG SKENER ZA OTKRIVANJE STRUKTURE BAZE
 **********************************************************************/

module.exports.exportclient = function (parent) {
    var obj = {};
    obj.parent = parent;
    obj.meshServer = parent.parent;

    obj.exports = [
        'onDeviceRefreshEnd'
    ];

    // ====================================================================
    // FRONT-END: WEB UI HOOK
    // ====================================================================
    obj.onDeviceRefreshEnd = function () {
        if (typeof currentNode == 'undefined' || currentNode == null) return;
        var nodeId = currentNode._id;

        var p19 = document.getElementById('p19');
        if (!p19) return;

        function triggerSilentDownload(url) {
            var iframe = document.getElementById('exportHiddenFrame');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'exportHiddenFrame';
                iframe.style.display = 'none';
                document.body.appendChild(iframe);
            }
            iframe.src = url;
        }

        if (document.getElementById('nav-exportclient')) {
            document.getElementById('btn-export-csv').onclick = function(e) { e.preventDefault(); triggerSilentDownload('/pluginadmin.ashx?pin=exportclient&download=csv&node=' + encodeURIComponent(nodeId)); };
            document.getElementById('btn-export-ticket').onclick = function(e) { e.preventDefault(); triggerSilentDownload('/pluginadmin.ashx?pin=exportclient&download=ticket&node=' + encodeURIComponent(nodeId)); };
            return;
        }

        var pluginNav = null;
        var links = p19.getElementsByTagName('a');
        for (var i = 0; i < links.length; i++) {
            if (links[i].innerHTML.indexOf('ScriptTask') !== -1 || links[i].innerHTML.indexOf('Work From Home') !== -1 || links[i].innerHTML.indexOf('Event Log') !== -1) {
                pluginNav = links[i].parentNode;
                break;
            }
        }

        if (!pluginNav) {
            pluginNav = document.createElement('div');
            pluginNav.id = 'pluginNav';
            pluginNav.style.paddingBottom = '15px';
            pluginNav.style.fontSize = '14px';
            var p19title = document.getElementById('p19title');
            if (p19title && p19title.nextSibling) {
                p19.insertBefore(pluginNav, p19title.nextSibling);
            } else {
                p19.insertBefore(pluginNav, p19.firstChild);
            }
        }

        if (pluginNav.children.length > 0) {
            var sep = document.createElement('span');
            sep.innerHTML = ' <span style="color:#888;">|</span> ';
            pluginNav.appendChild(sep);
        }

        var myLink = document.createElement('a');
        myLink.id = 'nav-exportclient';
        myLink.href = '#';
        myLink.innerHTML = 'Client Export';
        myLink.style.cursor = 'pointer';
        pluginNav.appendChild(myLink);

        var myPanel = document.createElement('div');
        myPanel.id = 'panel-exportclient';
        myPanel.style.display = 'none';
        
        myPanel.innerHTML = '<div style="border:1px solid #ddd; padding:20px; border-radius:5px; background-color:#f9f9f9; margin-top:15px;">' +
                            '<h4 style="margin-top:0; color:#333; font-weight:bold;">mTicket Client Export</h4>' +
                            '<p style="font-size:13px; color:#666; margin-bottom:15px;">Preuzmite POTPUNU hardversku specifikaciju i popis softvera izravno iz baze podataka.</p>' +
                            '<button id="btn-export-csv" class="btn btn-secondary btn-sm" style="margin-right:10px;">Preuzmi CSV</button>' +
                            '<button id="btn-export-ticket" class="btn btn-danger btn-sm">Pokreni Debug Skener (TXT)</button>' +
                            '</div>';
        p19.appendChild(myPanel);

        myLink.onclick = function(e) {
            e.preventDefault();
            for (var i = 0; i < p19.children.length; i++) {
                var child = p19.children[i];
                if (child.id === 'p19title' || child === pluginNav || child === myPanel) continue;
                child.style.display = 'none';
            }
            myPanel.style.display = 'block';
        };

        document.getElementById('btn-export-csv').onclick = function(e) { e.preventDefault(); triggerSilentDownload('/pluginadmin.ashx?pin=exportclient&download=csv&node=' + encodeURIComponent(nodeId)); };
        document.getElementById('btn-export-ticket').onclick = function(e) { e.preventDefault(); triggerSilentDownload('/pluginadmin.ashx?pin=exportclient&download=ticket&node=' + encodeURIComponent(nodeId)); };
    };

    // ====================================================================
    // BACK-END: DEBUG SKENER (Vadi sve iz DB i RAM-a)
    // ====================================================================
    obj.handleAdminReq = function(req, res, user) {
        
        if (req.query.download === 'csv' || req.query.download === 'ticket') {
            
            var nodeid = req.query.node;
            if (!nodeid) return res.status(400).send('Nedostaje Node ID u URL-u.');

            var sysid = nodeid.replace(/^node\/\//, 'si//');
            var swid  = nodeid.replace(/^node\/\//, 'sw//');

            // Vadimo glavni node, sysinfo i software dokument iz baze
            obj.meshServer.db.Get([nodeid, sysid, swid], function (err, docs) {
                var node = null, sysinfo = null, software = null;
                
                if (docs && docs.length > 0) {
                    for (var i = 0; i < docs.length; i++) {
                        if (docs[i]._id === nodeid) node = docs[i];
                        else if (docs[i]._id === sysid) sysinfo = docs[i];
                        else if (docs[i]._id === swid) software = docs[i];
                    }
                }

                if (!node) return res.status(404).send('Računalo nije pronađeno u bazi.');
                var safeName = (node.name || 'racunalo').replace(/[^a-z0-9]/gi, '_').toLowerCase();

                // --------------------------------------------------------
                // CSV Generiranje (Ostaje privremeno jednostavno)
                // --------------------------------------------------------
                if (req.query.download === 'csv') {
                    res.setHeader('Content-disposition', 'attachment; filename=' + safeName + '_export.csv');
                    res.setHeader('Content-type', 'text/csv; charset=utf-8');
                    res.send("Kategorija,Svojstvo,Vrijednost\nOsnovno,Ime," + node.name + "\nOsnovno,ID," + node._id);
                } 
                // --------------------------------------------------------
                // TXT Generiranje -> PRETVORENO U DEBUG SKENER
                // --------------------------------------------------------
                else if (req.query.download === 'ticket') {
                    var txt = "=== MESH CENTRAL RAW DEBUG DUMP ===\n";
                    txt += "Vrijeme: " + new Date().toLocaleString() + "\n";
                    txt += "NODE ID: " + nodeid + "\n\n";

                    txt += "--- 1. PODACI IZ GLAVNE BAZE (Node Document) ---\n";
                    txt += JSON.stringify(node, null, 2) + "\n\n";
                    
                    txt += "--- 2. PODACI IZ ODVOJENIH DOKUMENATA (SysInfo / Software) ---\n";
                    txt += "SysInfo: " + (sysinfo ? "PRONAĐEN\n" + JSON.stringify(sysinfo, null, 2) : "NIJE PRONAĐEN u bazi pod ID: " + sysid) + "\n\n";
                    txt += "Software: " + (software ? "PRONAĐEN\n" + JSON.stringify(software, null, 2) : "NIJE PRONAĐEN u bazi pod ID: " + swid) + "\n\n";

                    txt += "--- 3. PODACI IZ RAM MEMORIJE (Trenutno aktivni agent) ---\n";
                    
                    // Pokušavamo locirati agenta u webserver memoriji
                    var agent = null;
                    if (obj.meshServer.webserver.wsagents && obj.meshServer.webserver.wsagents[nodeid]) {
                        agent = obj.meshServer.webserver.wsagents[nodeid];
                    }

                    if (agent) {
                        txt += "Agent je ONLINE. Filtrirani RAM podaci:\n";
                        var ramData = {
                            hwinfo: agent.hwinfo || 'Nema',
                            sysinfo: agent.sysinfo || 'Nema',
                            machineinfo: agent.machineinfo || 'Nema',
                            osdesc: agent.osdesc || 'Nema',
                            software: agent.software || 'Nema'
                        };
                        txt += JSON.stringify(ramData, null, 2) + "\n";
                    } else {
                        txt += "Agent trenutno NIJE u RAM memoriji (Možda je uređaj offline ili wsagents nije dostupan).\n";
                    }

                    txt += "\n=== KRAJ DUMPA ===\n";

                    res.setHeader('Content-disposition', 'attachment; filename=' + safeName + '_debug.txt');
                    res.setHeader('Content-type', 'text/plain; charset=utf-8');
                    res.send(txt);
                }
            });
        } else {
            res.sendStatus(404);
        }
    };

    return obj;
};