'use strict';
/**********************************************************************
 * Copyright (C) 2026 Mr. Green & MCS
 * 
 * exportclient.js - Kompatibilno s Ryan Blenis arhitekturom
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

        // Osvježavanje postojećih tipki s novim /api/ rutama
        if (document.getElementById('nav-exportclient')) {
            document.getElementById('btn-export-csv').onclick = function(e) { e.preventDefault(); window.location.href = '/api/plugin/exportclient/csv?node=' + encodeURIComponent(nodeId); };
            document.getElementById('btn-export-ticket').onclick = function(e) { e.preventDefault(); window.location.href = '/api/plugin/exportclient/ticket?node=' + encodeURIComponent(nodeId); };
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
        myPanel.innerHTML = `
            <div style="border:1px solid #ddd; padding:20px; border-radius:5px; background-color:#f9f9f9; margin-top:15px;">
                <h4 style="margin-top:0; color:#333; font-weight:bold;">mTicket Client Export</h4>
                <p style="font-size:13px; color:#666; margin-bottom:15px;">Brzo preuzmite hardversku specifikaciju.</p>
                <button id="btn-export-csv" class="btn btn-secondary btn-sm" style="margin-right:10px;">Preuzmi CSV</button>
                <button id="btn-export-ticket" class="btn btn-primary btn-sm">Preuzmi TXT (Ticketing)</button>
            </div>
        `;
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

        // Tipke sada gađaju /api/ rute!
        document.getElementById('btn-export-csv').onclick = function(e) { e.preventDefault(); window.location.href = '/api/plugin/exportclient/csv?node=' + encodeURIComponent(nodeId); };
        document.getElementById('btn-export-ticket').onclick = function(e) { e.preventDefault(); window.location.href = '/api/plugin/exportclient/ticket?node=' + encodeURIComponent(nodeId); };
    };

    // ====================================================================
    // BACK-END: SERVER HOOK 
    // ====================================================================
    obj.server_startup = function () {
        
        // RUTA 1: CSV EXPORT (Sada API ruta)
        obj.meshServer.app.get('/api/plugin/exportclient/csv', function (req, res) {
            if (!req.session || !req.session.userid) return res.status(401).send('Pristup odbijen.');

            var nodeid = req.query.node;
            if (!nodeid) return res.status(400).send('Nedostaje Node ID u URL-u.');

            obj.meshServer.db.Get(nodeid, function (err, nodes) {
                if (err || !nodes || nodes.length !== 1) return res.status(404).send('Računalo nije pronađeno.');
                
                var node = nodes[0];
                var safeName = (node.name || 'racunalo').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                
                var csv = "Kategorija,Svojstvo,Vrijednost\n";
                csv += `Osnovno,Ime,${node.name || 'Nepoznato'}\n`;
                csv += `Osnovno,Opis,${node.desc || ''}\n`;
                csv += `Osnovno,OS,${node.mtype || ''}\n`;
                
                if (node.software) {
                    var swList = node.software.apps || node.software;
                    if (Array.isArray(swList)) {
                        swList.forEach(function(app) {
                            var appName = (app.name || app.N || 'Nepoznato').replace(/,/g, ' '); 
                            var appVer = (app.version || app.V || '').replace(/,/g, ' ');
                            csv += `Softver,${appName},${appVer}\n`;
                        });
                    }
                }

                res.setHeader('Content-disposition', 'attachment; filename=' + safeName + '_export.csv');
                res.setHeader('Content-type', 'text/csv; charset=utf-8');
                res.send(csv);
            });
        });

        // RUTA 2: TICKETING (TXT) EXPORT (Sada API ruta)
        obj.meshServer.app.get('/api/plugin/exportclient/ticket', function (req, res) {
            if (!req.session || !req.session.userid) return res.status(401).send('Pristup odbijen.');

            var nodeid = req.query.node;
            if (!nodeid) return res.status(400).send('Nedostaje Node ID u URL-u.');

            obj.meshServer.db.Get(nodeid, function (err, nodes) {
                if (err || !nodes || nodes.length !== 1) return res.status(404).send('Računalo nije pronađeno.');
                
                var node = nodes[0];
                var safeName = (node.name || 'racunalo').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                
                var txt = "=== MESH CENTRAL TICKET EXPORT ===\n";
                txt += "MC_NODE_ID: " + node._id + "\n";
                txt += "HOSTNAME: " + (node.name || 'N/A') + "\n";
                txt += "OS_TYPE: " + (node.mtype || 'N/A') + "\n";
                txt += "DESCRIPTION: " + (node.desc || 'N/A') + "\n";
                
                if (node.host) txt += "LAST_IP: " + node.host + "\n";
                
                txt += "--- HARDWARE ---\n";
                if (node.hwinfo) {
                    txt += JSON.stringify(node.hwinfo, null, 2) + "\n";
                } else {
                    txt += "N/A\n";
                }
                txt += "=== END OF EXPORT ===\n";

                res.setHeader('Content-disposition', 'attachment; filename=' + safeName + '_ticket.txt');
                res.setHeader('Content-type', 'text/plain; charset=utf-8');
                res.send(txt);
            });
        });
    };

    return obj;
};