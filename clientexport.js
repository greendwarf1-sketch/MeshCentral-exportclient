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
    // FRONT-END: WEB UI HOOK (Pametno traženje izbornika)
    // ====================================================================
    obj.onDeviceRefreshEnd = function () {
        if (typeof currentNode == 'undefined' || currentNode == null) return;
        var nodeId = currentNode._id;

        // p19 je fiksni kontejner za "Plugins" karticu u MeshCentralu
        var p19 = document.getElementById('p19');
        if (!p19) return;

        // Ako je naša tipka već dodana, samo ažuriramo NodeID i prekidamo
        if (document.getElementById('nav-clientexport')) {
            document.getElementById('btn-export-csv').onclick = function(e) { e.preventDefault(); window.location.href = '/plugin/clientexport/csv/' + encodeURIComponent(nodeId); };
            document.getElementById('btn-export-ticket').onclick = function(e) { e.preventDefault(); window.location.href = '/plugin/clientexport/ticket/' + encodeURIComponent(nodeId); };
            return;
        }

        // 1. PRONALAZAK POSTOJEĆEG MENIJA OSTALIH PLUGIN-OVA
        // Skripta traži gdje su se smjestili drugi pluginovi kako bi se smjestila kraj njih
        var pluginNav = null;
        var links = p19.getElementsByTagName('a');
        for (var i = 0; i < links.length; i++) {
            if (links[i].innerHTML.indexOf('ScriptTask') !== -1 || 
                links[i].innerHTML.indexOf('Work From Home') !== -1 || 
                links[i].innerHTML.indexOf('Event Log') !== -1) {
                pluginNav = links[i].parentNode;
                break;
            }
        }

        // 2. FALLBACK KREIRANJE MENIJA (ako nema drugih pluginova)
        if (!pluginNav) {
            pluginNav = document.createElement('div');
            pluginNav.style.paddingBottom = '15px';
            pluginNav.style.fontSize = '14px';
            var p19title = document.getElementById('p19title');
            if (p19title && p19title.nextSibling) {
                p19.insertBefore(pluginNav, p19title.nextSibling);
            } else {
                p19.insertBefore(pluginNav, p19.firstChild);
            }
        }

        // 3. DODAVANJE NAŠEG LINKA U MENI
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

        // 4. KREIRANJE NAŠEG PANELA (Skrivenog po defaultu)
        var myPanel = document.createElement('div');
        myPanel.id = 'panel-clientexport';
        myPanel.style.display = 'none';
        myPanel.innerHTML = `
            <div style="border:1px solid #ddd; padding:20px; border-radius:5px; background-color:#f9f9f9; margin-top:15px;">
                <h4 style="margin-top:0; color:#333; font-weight:bold;">
                    📥 mTicket Client Export
                </h4>
                <p style="font-size:13px; color:#666; margin-bottom:15px;">
                    Brzo preuzmite hardversku specifikaciju i popis instaliranog softvera za ovaj uređaj.
                </p>
                <button id="btn-export-csv" class="btn btn-secondary btn-sm" style="margin-right:10px;">
                    Preuzmi CSV
                </button>
                <button id="btn-export-ticket" class="btn btn-primary btn-sm">
                    Preuzmi TXT (Ticketing)
                </button>
            </div>
        `;
        p19.appendChild(myPanel);

        // 5. LOGIKA ZA PREBACIVANJE KARTICA (Kao kod ostalih pluginova)
        myLink.onclick = function(e) {
            e.preventDefault();
            
            // Sakrij sve ostale panele unutar p19
            for (var i = 0; i < p19.children.length; i++) {
                var child = p19.children[i];
                // Ne skrivaj naslov, glavnu navigaciju menija ili naš vlastiti panel
                if (child.id === 'p19title' || child.contains(pluginNav) || child === myPanel) {
                    continue;
                }
                child.style.display = 'none';
            }
            
            // Prikaži isključivo naš panel
            myPanel.style.display = 'block';
        };

        // 6. AKCIJE ZA TIPKE
        document.getElementById('btn-export-csv').onclick = function(e) { 
            e.preventDefault(); 
            window.location.href = '/plugin/clientexport/csv/' + encodeURIComponent(nodeId); 
        };
        document.getElementById('btn-export-ticket').onclick = function(e) { 
            e.preventDefault(); 
            window.location.href = '/plugin/clientexport/ticket/' + encodeURIComponent(nodeId); 
        };
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