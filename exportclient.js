'use strict';
/**********************************************************************
 * Copyright (C) 2026 Mr. Green & MCS
 * 
 * exportclient.js - Backend Full Export + Smart DB Error Handler
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
                            '<button id="btn-export-ticket" class="btn btn-primary btn-sm">Preuzmi TXT (Ticketing)</button>' +
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
    // BACK-END: PAMETNI HTTP HANDLER
    // ====================================================================
    obj.handleAdminReq = function(req, res, user) {
        
        if (req.query.download === 'csv' || req.query.download === 'ticket') {
            
            var nodeid = req.query.node;
            if (!nodeid) return res.status(400).send('Nedostaje Node ID u URL-u.');

            var sysid = nodeid.replace(/^node\/\//, 'si//');
            var swid  = nodeid.replace(/^node\/\//, 'sw//');

            // Sigurna funkcija za čitanje baze (pokušava veliko i malo slovo)
            var safeDbGet = function(id, callback) {
                if (typeof obj.meshServer.db.Get === 'function') {
                    obj.meshServer.db.Get(id, callback);
                } else if (typeof obj.meshServer.db.get === 'function') {
                    obj.meshServer.db.get(id, callback);
                } else {
                    callback("GREŠKA: Nije pronađena db.Get funkcija u MeshCentral jezgri!", null);
                }
            };

            // 1. Čitanje glavnog Node dokumenta
            safeDbGet(nodeid, function (err, nodes) {
                
                var node = null;
                // Fleksibilna provjera (ako je MongoDB vraća Array, ako je NeDB može vratiti direktno objekt)
                if (Array.isArray(nodes) && nodes.length > 0) node = nodes[0];
                else if (nodes && !Array.isArray(nodes) && nodes._id) node = nodes;

                // AKO PADNE, ISPISUJEMO DETALJE U BROWSER!
                if (!node) {
                    var debugHtml = "<h3>Greška baze podataka!</h3>" +
                                    "<p><b>Traženi ID:</b> " + nodeid + "</p>" +
                                    "<p><b>DB Error Varijabla:</b> " + String(err) + "</p>" +
                                    "<p><b>DB Nodes Odgovor:</b> " + JSON.stringify(nodes) + "</p>";
                    return res.send(debugHtml);
                }

                // 2. Čitanje Hardvera
                safeDbGet(sysid, function (err, sysnodes) {
                    var sysinfo = null;
                    if (Array.isArray(sysnodes) && sysnodes.length > 0) sysinfo = sysnodes[0];
                    else if (sysnodes && !Array.isArray(sysnodes) && sysnodes._id) sysinfo = sysnodes;

                    // 3. Čitanje Softvera
                    safeDbGet(swid, function (err, swnodes) {
                        var software = null;
                        if (Array.isArray(swnodes) && swnodes.length > 0) software = swnodes[0];
                        else if (swnodes && !Array.isArray(swnodes) && swnodes._id) software = swnodes;

                        // Pripajanje podataka
                        var hw = sysinfo ? (sysinfo.data || sysinfo.hwinfo || sysinfo) : node.hwinfo;
                        var sw = software ? (software.data || software.apps || software.software || software) : node.software;
                        
                        var safeName = (node.name || 'racunalo').replace(/[^a-z0-9]/gi, '_').toLowerCase();

                        // --- CSV DOWNLOAD ---
                        if (req.query.download === 'csv') {
                            var csv = "Kategorija,Svojstvo,Vrijednost\n";
                            csv += `Osnovno,Ime,${node.name || 'Nepoznato'}\n`;
                            csv += `Osnovno,Opis,${node.desc || ''}\n`;
                            csv += `Osnovno,OS,${node.osdesc || node.mtype || ''}\n`;
                            
                            if (sw) {
                                var swList = sw.apps || sw; 
                                if (Array.isArray(swList)) {
                                    swList.forEach(function(app) {
                                        var appName = (app.name || app.N || 'Nepoznato').replace(/,/g, ' '); 
                                        var appVer = (app.version || app.V || '').replace(/,/g, ' ');
                                        csv += `Softver,${appName},${appVer}\n`;
                                    });
                                } else {
                                    csv += "Softver,Napomena,Pronađen nestandardni format softvera\n";
                                }
                            } else {
                                csv += "Softver,Napomena,Agent još nije sinkronizirao softver u bazu\n";
                            }

                            res.setHeader('Content-disposition', 'attachment; filename=' + safeName + '_export.csv');
                            res.setHeader('Content-type', 'text/csv; charset=utf-8');
                            res.send(csv);
                        } 
                        // --- TXT DOWNLOAD ---
                        else if (req.query.download === 'ticket') {
                            var txt = "=== MESH CENTRAL TICKET EXPORT ===\n";
                            txt += "MC_NODE_ID: " + node._id + "\n";
                            txt += "HOSTNAME: " + (node.name || 'N/A') + "\n";
                            txt += "OS_TYPE: " + (node.osdesc || node.mtype || 'N/A') + "\n";
                            txt += "DESCRIPTION: " + (node.desc || 'N/A') + "\n";
                            
                            if (node.host) txt += "LAST_IP: " + node.host + "\n";
                            
                            txt += "\n--- HARDWARE ---\n";
                            if (hw) {
                                txt += JSON.stringify(hw, null, 2) + "\n";
                            } else {
                                txt += "Nema hardverskih podataka u bazi.\n";
                            }

                            txt += "\n--- SOFTWARE ---\n";
                            if (sw) {
                                txt += JSON.stringify(sw, null, 2) + "\n";
                            } else {
                                txt += "Nema softverskih podataka u bazi.\n";
                            }

                            txt += "\n=== END OF EXPORT ===\n";

                            res.setHeader('Content-disposition', 'attachment; filename=' + safeName + '_ticket.txt');
                            res.setHeader('Content-type', 'text/plain; charset=utf-8');
                            res.send(txt);
                        }
                    });
                });
            });
        } else {
            res.sendStatus(404);
        }
    };

    return obj;
};