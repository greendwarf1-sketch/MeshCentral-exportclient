'use strict';
/**********************************************************************
 * Copyright (C) 2026 Mr. Green & MCS
 * 
 * clientexport.js - Ispravljeni plugin za MeshCentral sučelje
 **********************************************************************/

module.exports.clientexport = function (parent) {
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
        // Provjeravamo je li korisnik na stranici pojedinačnog uređaja
        if (typeof currentNode == 'undefined' || currentNode == null) return;
        
        var nodeId = currentNode._id;

        // Provjeravamo postoje li već tipke da ih ne dupliciramo
        if (document.getElementById('btn-export-csv')) return;

        // Tražimo ispravan kontejner na stranici uređaja (gdje su General, Desktop, Terminal...)
        // MeshCentral sprema akcije/gumbe unutar gornjeg desnog dijela panela uređaja
        var targetContainer = document.getElementById('devicetabtext') || document.getElementById('devicePanel');
        
        // Ako ne nađemo tab tekst, tražimo alternativni toolbar u zaglavlju uređaja
        if (!targetContainer) {
            targetContainer = document.querySelector('.deviceToolbar') || document.getElementById('nodeactiontable');
        }

        if (targetContainer) {
            // Okvir za naše izvoze da bude uredno složeno
            var wrapper = document.createElement('div');
            wrapper.id = 'clientexport-wrapper';
            wrapper.style.display = 'inline-block';
            wrapper.style.marginLeft = '15px';
            wrapper.style.verticalAlign = 'middle';

            // Kreiranje tipke za CSV
            var btnCsv = document.createElement('button');
            btnCsv.id = 'btn-export-csv';
            btnCsv.innerHTML = '📥 Export CSV';
            btnCsv.className = 'btn btn-default btn-sm'; 
            btnCsv.style.marginRight = '5px';
            btnCsv.onclick = function(e) {
                e.preventDefault();
                window.location.href = '/plugin/clientexport/csv/' + encodeURIComponent(nodeId);
            };

            // Kreiranje tipke za Ticketing (TXT)
            var btnTicket = document.createElement('button');
            btnTicket.id = 'btn-export-ticket';
            btnTicket.innerHTML = '🎫 Export u Ticketing';
            btnTicket.className = 'btn btn-primary btn-sm';
            btnTicket.onclick = function(e) {
                e.preventDefault();
                window.location.href = '/plugin/clientexport/ticket/' + encodeURIComponent(nodeId);
            };

            // Pakiramo tipke u wrapper i ubacujemo u sučelje
            wrapper.appendChild(btnCsv);
            wrapper.appendChild(btnTicket);
            targetContainer.appendChild(wrapper);
        }
    };


    // ====================================================================
    // BACK-END: SERVER HOOK
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