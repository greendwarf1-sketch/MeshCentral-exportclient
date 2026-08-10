'use strict';
/**********************************************************************
 * Copyright (C) 2026 Mr. Green & MCS
 * 
 * clientexport.js - Integracija u Plugins tab (p19)
 **********************************************************************/

module.exports.clientexport = function (parent) {
    var obj = {};
    obj.parent = parent;
    obj.meshServer = parent.parent;

    obj.exports = [
        'onDeviceRefreshEnd'
    ];

    // ====================================================================
    // FRONT-END: WEB UI HOOK (Prikaz u "Plugins" tabu)
    // ====================================================================
    obj.onDeviceRefreshEnd = function () {
        // Preskačemo ako nismo na stranici konkretnog računala
        if (typeof currentNode == 'undefined' || currentNode == null) return;
        var nodeId = currentNode._id;

        // p19 je fiksni kontejner za karticu "Plugins" u MeshCentralu
        var p19 = document.getElementById('p19');
        if (!p19) return;

        // Sprječavamo dupliciranje kućice pri prebacivanju između računala
        var existingBox = document.getElementById('clientExportBox');
        if (existingBox) {
            // Samo ažuriramo linkove s ID-em novog računala
            document.getElementById('btn-export-csv').onclick = function(e) { e.preventDefault(); window.location.href = '/plugin/clientexport/csv/' + encodeURIComponent(nodeId); };
            document.getElementById('btn-export-ticket').onclick = function(e) { e.preventDefault(); window.location.href = '/plugin/clientexport/ticket/' + encodeURIComponent(nodeId); };
            return;
        }

        // Kreiramo modernu kućicu (Bootstrap Card) koja prati dizajn MeshCentrala
        var exportBox = document.createElement('div');
        exportBox.id = 'clientExportBox';
        exportBox.className = 'card mb-3 mt-3'; // Bootstrap margine
        exportBox.style.marginLeft = '10px';
        exportBox.style.marginRight = '10px';
        exportBox.style.borderTop = '3px solid #0d6efd'; // Plava traka na vrhu za vizualni naglasak
        exportBox.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)';

        // Unutarnji HTML kućice s ugrađenim FontAwesome ikonama
        exportBox.innerHTML = `
            <div class="card-body">
                <h5 class="card-title text-primary" style="font-weight:bold;">
                    <i class="fa-solid fa-file-export me-2"></i> mTicket Client Export
                </h5>
                <p class="card-text" style="font-size:13px; color:#666;">
                    Brzo preuzmite hardversku specifikaciju i popis instaliranog softvera za ovaj uređaj.
                </p>
                <button id="btn-export-csv" class="btn btn-secondary btn-sm me-2">
                    <i class="fa-solid fa-file-csv me-1"></i> Preuzmi CSV
                </button>
                <button id="btn-export-ticket" class="btn btn-primary btn-sm">
                    <i class="fa-solid fa-file-lines me-1"></i> Preuzmi TXT (mTicket)
                </button>
            </div>
        `;

        // Ubacujemo našu kućicu na sam vrh Plugins taba (odmah ispod naslova)
        var p19title = document.getElementById('p19title');
        if (p19title && p19title.nextSibling) {
            p19.insertBefore(exportBox, p19title.nextSibling);
        } else {
            p19.insertBefore(exportBox, p19.firstChild);
        }

        // Dodjeljujemo funkcionalnosti gumbima NAKON što su ubačeni na ekran
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