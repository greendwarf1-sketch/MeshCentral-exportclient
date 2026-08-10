'use strict';
/**********************************************************************
 * Copyright (C) 2026 Mr. Green & MCS
 * 
 * clientexport.js - Kompatibilno s Ryan Blenis arhitekturom
 **********************************************************************/

module.exports.clientexport = function (parent) {
    var obj = {};
    obj.parent = parent;
    obj.meshServer = parent.parent;

    obj.exports = [
        'onDeviceRefreshEnd'
    ];

// ====================================================================
    // FRONT-END: WEB UI HOOK (S ugrađenim logovima za traženje grešaka)
    // ====================================================================
    obj.onDeviceRefreshEnd = function () {
        console.log("ClientExport [TEST 1]: Pokrenut onDeviceRefreshEnd funkcija!");

        if (typeof currentNode == 'undefined' || currentNode == null) {
            console.log("ClientExport [GREŠKA]: Nema odabranog računala (currentNode je prazan).");
            return;
        }
        var nodeId = currentNode._id;
        console.log("ClientExport [TEST 2]: Trenutni node ID prepoznat -> " + nodeId);

        var p19 = document.getElementById('p19');
        if (!p19) {
            console.log("ClientExport [GREŠKA]: Ne mogu pronaći kontejner 'p19' (Plugins kartica ne postoji u HTML-u)!");
            return;
        }
        console.log("ClientExport [TEST 3]: Pronađen kontejner p19.");

        if (document.getElementById('nav-clientexport')) {
            console.log("ClientExport [TEST 4]: Gumb već postoji na ekranu, samo osvježavam Node ID.");
            document.getElementById('btn-export-csv').onclick = function(e) { e.preventDefault(); window.location.href = '/plugin/clientexport/csv/' + encodeURIComponent(nodeId); };
            document.getElementById('btn-export-ticket').onclick = function(e) { e.preventDefault(); window.location.href = '/plugin/clientexport/ticket/' + encodeURIComponent(nodeId); };
            return;
        }

        var pluginNav = null;
        var links = p19.getElementsByTagName('a');
        console.log("ClientExport [TEST 5]: Tražim postojeći izbornik drugih pluginova. Pronađeno linkova: " + links.length);
        
        for (var i = 0; i < links.length; i++) {
            if (links[i].innerHTML.indexOf('ScriptTask') !== -1 || links[i].innerHTML.indexOf('Work From Home') !== -1 || links[i].innerHTML.indexOf('Event Log') !== -1) {
                pluginNav = links[i].parentNode;
                console.log("ClientExport [TEST 6]: Uspješno zakačen na postojeći meni drugog plugina.");
                break;
            }
        }

        if (!pluginNav) {
            console.log("ClientExport [TEST 6-B]: Nema drugih pluginova, pokušavam kreirati vlastiti meni.");
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

        console.log("ClientExport [TEST 7]: Crtam link u meni.");
        if (pluginNav.children.length > 0) {
            var sep = document.createElement('span');
            sep.innerHTML = ' <span style="color:#888;">|</span> ';
            pluginNav.appendChild(sep);
        }

        var myLink = document.createElement('a');
        myLink.id = 'nav-clientexport';
        myLink.href = '#';
        myLink.innerHTML = 'Client Export';
        myLink.style.cursor = 'pointer';
        pluginNav.appendChild(myLink);

        console.log("ClientExport [TEST 8]: Kreiram ploču sa sadržajem.");
        var myPanel = document.createElement('div');
        myPanel.id = 'panel-clientexport';
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

        document.getElementById('btn-export-csv').onclick = function(e) { e.preventDefault(); window.location.href = '/plugin/clientexport/csv/' + encodeURIComponent(nodeId); };
        document.getElementById('btn-export-ticket').onclick = function(e) { e.preventDefault(); window.location.href = '/plugin/clientexport/ticket/' + encodeURIComponent(nodeId); };
        
        console.log("ClientExport [TEST 9]: SVE JE USPJEŠNO ODRAĐENO!");
    };

    // ====================================================================
    // BACK-END: SERVER HOOK (Generiranje datoteka)
    // ====================================================================
    obj.server_startup = function () {
        
        // RUTA 1: CSV EXPORT
        obj.meshServer.app.get('/plugin/clientexport/csv/:nodeid', function (req, res) {
            if (!req.session || !req.session.userid) return res.status(401).send('Pristup odbijen.');

            var nodeid = decodeURIComponent(req.params.nodeid);
            obj.meshServer.db.Get(nodeid, function (err, nodes) {
                if (err || !nodes || nodes.length !== 1) return res.status(404).send('Računalo nije pronađeno.');
                
                var node = nodes[0];
                var safeName = (node.name || 'racunalo').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                
                var csv = "Kategorija,Svojstvo,Vrijednost\n";
                csv += \`Osnovno,Ime,\${node.name || 'Nepoznato'}\n\`;
                csv += \`Osnovno,Opis,\${node.desc || ''}\n\`;
                csv += \`Osnovno,OS,\${node.mtype || ''}\n\`;
                
                if (node.software) {
                    var swList = node.software.apps || node.software;
                    if (Array.isArray(swList)) {
                        swList.forEach(function(app) {
                            var appName = (app.name || app.N || 'Nepoznato').replace(/,/g, ' '); 
                            var appVer = (app.version || app.V || '').replace(/,/g, ' ');
                            csv += \`Softver,\${appName},\${appVer}\n\`;
                        });
                    }
                }

                res.setHeader('Content-disposition', 'attachment; filename=' + safeName + '_export.csv');
                res.setHeader('Content-type', 'text/csv; charset=utf-8');
                res.send(csv);
            });
        });

        // RUTA 2: TICKETING (TXT) EXPORT
        obj.meshServer.app.get('/plugin/clientexport/ticket/:nodeid', function (req, res) {
            if (!req.session || !req.session.userid) return res.status(401).send('Pristup odbijen.');

            var nodeid = decodeURIComponent(req.params.nodeid);
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