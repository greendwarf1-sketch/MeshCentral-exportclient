'use strict';
/**********************************************************************
 * Copyright (C) 2026 Mr. Green
 * 
 * clientexport.js - Kompatibilno s Ryan Blenis plugin arhitekturom
 **********************************************************************/

module.exports.clientexport = function (parent) {
    var obj = {};
    obj.parent = parent;
    obj.meshServer = parent.parent;

    obj.exports = [
        'onDeviceRefreshEnd'
    ];

    // ====================================================================
    // FRONT-END: WEB UI HOOK (Ryan Blenis "pluginNav" standard)
    // ====================================================================
    obj.onDeviceRefreshEnd = function () {
        // Preskačemo ako nismo na stranici konkretnog računala
        if (typeof currentNode == 'undefined' || currentNode == null) return;
        var nodeId = currentNode._id;

        // p19 je fiksni kontejner za "Plugins" karticu u MeshCentralu
        var p19 = document.getElementById('p19');
        var p19title = document.getElementById('p19title');
        if (!p19 || !p19title) return;

        // 1. Pronađi ili kreiraj glavni navigacijski meni za pluginove (pluginNav)
        var pluginNav = document.getElementById('pluginNav');
        if (!pluginNav) {
            pluginNav = document.createElement('div');
            pluginNav.id = 'pluginNav';
            pluginNav.style.paddingBottom = '15px';
            pluginNav.style.fontSize = '14px';
            // Ubacujemo navigaciju odmah ispod glavnog naslova
            p19title.parentNode.insertBefore(pluginNav, p19title.nextSibling);
        }

        // 2. Dodaj naš link ("Client Export") u meni ako već ne postoji
        if (!document.getElementById('nav-clientexport')) {
            // Ako već ima drugih pluginova (poput ScriptTask), dodajemo separator "|"
            if (pluginNav.children.length > 0) {
                var sep = document.createElement('span');
                sep.innerHTML = ' <span style="color:#888;">|</span> ';
                pluginNav.appendChild(sep);
            }
            
            var link = document.createElement('a');
            link.id = 'nav-clientexport';
            link.href = '#';
            link.innerHTML = 'Client Export';
            link.style.cursor = 'pointer';
            link.onclick = function(e) {
                e.preventDefault();
                
                // a) Sakrij sve ostale panele unutar p19 taba (ScriptTask, EventLog...)
                for (var i = 0; i < p19.children.length; i++) {
                    var child = p19.children[i];
                    if (child.id !== 'p19title' && child.id !== 'pluginNav') {
                        child.style.display = 'none';
                    }
                }
                // b) Prikaži samo naš panel
                var myPanel = document.getElementById('panel-clientexport');
                if (myPanel) myPanel.style.display = 'block';
            };
            pluginNav.appendChild(link);
        }

        // 3. Kreiraj naš sadržajni panel (skriven po defaultu)
        var myPanel = document.getElementById('panel-clientexport');
        if (!myPanel) {
            myPanel = document.createElement('div');
            myPanel.id = 'panel-clientexport';
            myPanel.className = 'pluginPanel'; // Standardna klasa ostalih pluginova
            myPanel.style.display = 'none'; // Sakriveno dok korisnik ne klikne na izbornik
            
            // Vizualni dizajn unutar panela (naslov, opis i tipke)
            myPanel.innerHTML = `
                <div style="border:1px solid #ddd; padding:20px; border-radius:5px; background-color:#fcfcfc;">
                    <h4 style="margin-top:0; color:#333; font-weight:bold;">
                        mTicket Client Export
                    </h4>
                    <p style="font-size:13px; color:#666; margin-bottom:15px;">
                        Brzo preuzmite hardversku specifikaciju i popis instaliranog softvera za ovaj uređaj.
                    </p>
                    <button id="btn-export-csv" class="btn btn-secondary btn-sm" style="margin-right:10px;">
                        📥 Preuzmi CSV
                    </button>
                    <button id="btn-export-ticket" class="btn btn-primary btn-sm">
                        🎫 Preuzmi TXT (Ticketing)
                    </button>
                </div>
            `;
            p19.appendChild(myPanel);
        }

        // 4. Ažuriraj ID uređaja na tipkama (kako bi uvijek gađao trenutno otvoreno računalo)
        var btnCsv = document.getElementById('btn-export-csv');
        var btnTicket = document.getElementById('btn-export-ticket');
        
        if (btnCsv) {
            btnCsv.onclick = function(e) { 
                e.preventDefault(); 
                window.location.href = '/plugin/clientexport/csv/' + encodeURIComponent(nodeId); 
            };
        }
        if (btnTicket) {
            btnTicket.onclick = function(e) { 
                e.preventDefault(); 
                window.location.href = '/plugin/clientexport/ticket/' + encodeURIComponent(nodeId); 
            };
        }
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
                
                var csv = "Kategorija,Svojstvo,Vrijednost\\n";
                csv += \`Osnovno,Ime,\${node.name || 'Nepoznato'}\\n\`;
                csv += \`Osnovno,Opis,\${node.desc || ''}\\n\`;
                csv += \`Osnovno,OS,\${node.mtype || ''}\\n\`;
                
                if (node.software) {
                    var swList = node.software.apps || node.software;
                    if (Array.isArray(swList)) {
                        swList.forEach(function(app) {
                            var appName = (app.name || app.N || 'Nepoznato').replace(/,/g, ' '); 
                            var appVer = (app.version || app.V || '').replace(/,/g, ' ');
                            csv += \`Softver,\${appName},\${appVer}\\n\`;
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
                
                var txt = "=== MESH CENTRAL TICKET EXPORT ===\\n";
                txt += "MC_NODE_ID: " + node._id + "\\n";
                txt += "HOSTNAME: " + (node.name || 'N/A') + "\\n";
                txt += "OS_TYPE: " + (node.mtype || 'N/A') + "\\n";
                txt += "DESCRIPTION: " + (node.desc || 'N/A') + "\\n";
                
                if (node.host) txt += "LAST_IP: " + node.host + "\\n";
                
                txt += "--- HARDWARE ---\\n";
                if (node.hwinfo) {
                    txt += JSON.stringify(node.hwinfo, null, 2) + "\\n";
                } else {
                    txt += "N/A\\n";
                }
                txt += "=== END OF EXPORT ===\\n";

                res.setHeader('Content-disposition', 'attachment; filename=' + safeName + '_ticket.txt');
                res.setHeader('Content-type', 'text/plain; charset=utf-8');
                res.send(txt);
            });
        });
    };

    return obj;
};