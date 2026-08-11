'use strict';
/**********************************************************************
 * Copyright (C) 2026 Mr. Green & MCS
 * exportclient.js - DOM-Scraping mTicket Sync (3 Buttons Edition)
 **********************************************************************/

module.exports.exportclient = function (parent) {
    var obj = {};
    obj.parent = parent;
    obj.meshServer = parent.parent;

    obj.exports = [
        'onDeviceRefreshEnd'
    ];

    // ====================================================================
    // 1. FRONT-END: Čitanje aplikacija i ubacivanje 3 tipke
    // ====================================================================
    obj.onDeviceRefreshEnd = function () {
        if (typeof currentNode == 'undefined' || currentNode == null) return;
        var nodeId = currentNode._id;

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

        // Brišemo staru grupu tipki da se ne bi duplicirale prilikom osvježavanja taba
        var existingGroup = document.getElementById('btn-tab-mticket-group');
        if (existingGroup) existingGroup.remove();

        // ----------------------------------------------------------------
        // KREIRANJE GRUPE OD 3 TIPKE
        // ----------------------------------------------------------------
        var btnGroup = document.createElement('span');
        btnGroup.id = 'btn-tab-mticket-group';
        btnGroup.style.marginLeft = '10px';
        btnGroup.style.verticalAlign = 'middle';

        var btnCsv = document.createElement('button');
        btnCsv.className = 'btn btn-secondary btn-sm';
        btnCsv.style.marginRight = '5px';
        btnCsv.innerHTML = '📥 Preuzmi CSV';
        btnCsv.onclick = function(e) { 
            e.preventDefault(); 
            triggerSilentDownload('/pluginadmin.ashx?pin=exportclient&download=csv&node=' + encodeURIComponent(nodeId)); 
        };

        var btnTxt = document.createElement('button');
        btnTxt.className = 'btn btn-primary btn-sm';
        btnTxt.style.marginRight = '5px';
        btnTxt.innerHTML = '🎫 Preuzmi TXT';
        btnTxt.onclick = function(e) { 
            e.preventDefault(); 
            triggerSilentDownload('/pluginadmin.ashx?pin=exportclient&download=ticket&node=' + encodeURIComponent(nodeId)); 
        };

        var syncBtn = document.createElement('button');
        syncBtn.className = 'btn btn-success btn-sm';
        syncBtn.innerHTML = '🚀 Pošalji u mTicket';
        
        syncBtn.onclick = function(e) {
            e.preventDefault();
            var btn = this;
            var originalText = btn.innerHTML;
            btn.innerHTML = '⏳ Čitanje ekrana...';
            btn.disabled = true;

            // DOM SCRAPING: Kupimo podatke direktno iz tablice na ekranu
            var extractedApps = [];
            var rows = document.querySelectorAll('table tr, .table tr');
            
            for (var i = 0; i < rows.length; i++) {
                var cols = rows[i].querySelectorAll('td');
                // offsetParent !== null osigurava da ne čitamo skrivene redove iz drugih tabova
                if (cols.length >= 2 && cols[0].offsetParent !== null) {
                    var appName = cols[0].innerText ? cols[0].innerText.trim() : '';
                    var appVer = cols[1].innerText ? cols[1].innerText.trim() : '';
                    if (appName && appName !== 'Name') {
                        extractedApps.push({ name: appName, version: appVer });
                    }
                }
            }

            btn.innerHTML = '⏳ Slanje...';

            var ws = null;
            if (typeof meshserver != 'undefined' && meshserver != null) ws = meshserver;
            else if (typeof server != 'undefined' && server != null) ws = server;
            else if (typeof window.meshserver != 'undefined' && window.meshserver != null) ws = window.meshserver;
            else if (typeof app != 'undefined' && app != null && app.server != null) ws = app.server;

            if (ws != null) {
                ws.send({ 
                    action: 'plugin', 
                    plugin: 'exportclient', 
                    pluginaction: 'send_api_sync',
                    nodeId: nodeId,
                    scrapedSoftware: extractedApps 
                });
                
                setTimeout(function() {
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                    var msg = extractedApps.length > 0 ? ('Pročitano aplikacija: ' + extractedApps.length) : 'Podaci iz Details taba poslani u pozadini.';
                    alert('✅ Uspješno poslano u mTicket!\n' + msg);
                }, 1000);
            } else {
                btn.innerHTML = originalText;
                btn.disabled = false;
                alert('❌ Greška: Nema aktivne WebSocket veze.');
            }
        };

        btnGroup.appendChild(btnCsv);
        btnGroup.appendChild(btnTxt);
        btnGroup.appendChild(syncBtn);

        // ----------------------------------------------------------------
        // UBACIVANJE TIPKI U AKTIVNI TAB
        // ----------------------------------------------------------------
        
        // Pokušaj 1: Software Tab (Tvoja provjerena metoda)
        var searchInput = document.querySelector('input[placeholder*="Search software"]');
        if (searchInput && searchInput.offsetParent !== null) {
            var toolbar = searchInput.parentNode;
            toolbar.appendChild(btnGroup);
            return;
        }

        // Pokušaj 2: Details Tab
        var detailsTable = document.getElementById('devdetailstable');
        if (detailsTable && detailsTable.offsetParent !== null) {
            btnGroup.style.marginBottom = '15px'; // Malo razmaka ispod tipki
            btnGroup.style.display = 'block'; 
            detailsTable.parentNode.insertBefore(btnGroup, detailsTable);
            return;
        }
    };

    // ====================================================================
    // 2. BACK-END ENGINE: Prihvat scraped podataka i slanje u mTicket
    // ====================================================================
    obj.serveraction = function (command, myparent, user) {
        if (command.action === 'plugin' && command.plugin === 'exportclient' && command.pluginaction === 'send_api_sync') {
            
            var nodeid = command.nodeId;
            if (!nodeid) return;

            var sysid = nodeid.replace(/^node\/\//, 'si//');

            var safeDbGet = function(id, callback) {
                if (typeof obj.meshServer.db.Get === 'function') obj.meshServer.db.Get(id, callback);
                else if (typeof obj.meshServer.db.get === 'function') obj.meshServer.db.get(id, callback);
                else callback("Nema DB funkcije", null);
            };

            safeDbGet(nodeid, function (err, nodes) {
                var node = null;
                if (Array.isArray(nodes) && nodes.length > 0) node = nodes[0];
                else if (nodes && !Array.isArray(nodes) && nodes._id) node = nodes;

                if (!node) return;

                safeDbGet(sysid, function (err, sysnodes) {
                    var sysinfo = null;
                    if (Array.isArray(sysnodes) && sysnodes.length > 0) sysinfo = sysnodes[0];
                    else if (sysnodes && !Array.isArray(sysnodes) && sysnodes._id) sysinfo = sysnodes;

                    var hw = sysinfo ? (sysinfo.public || sysinfo.data || sysinfo.hwinfo || sysinfo) : (node.hwinfo || node.hardware || node.sysinfo);

                    var wsagents = obj.meshServer.webserver.wsagents;
                    if (wsagents && wsagents[nodeid] && !hw) {
                        hw = wsagents[nodeid].hwinfo || wsagents[nodeid].hardware;
                    }

                    var payloadObj = {
                        node_id: node._id,
                        name: node.name || 'Nepoznato',
                        os: node.osdesc || node.mtype || 'Nepoznato',
                        ip: node.host || 'Offline',
                        hardware: hw || null,
                        software: { apps: command.scrapedSoftware || [] }
                    };

                    var payloadStr = JSON.stringify(payloadObj);

                    var https = require('https');
                    var url = require('url');
                    var mTicketURL = "https://podrska.mcs-informatika.hr/webhook_mesh.php?token=Kljuc12345MCS!";
                    var apiReqUrl = new url.URL(mTicketURL);
                    
                    var options = {
                        hostname: apiReqUrl.hostname,
                        port: apiReqUrl.port || 443,
                        path: apiReqUrl.pathname + apiReqUrl.search,
                        method: 'POST',
                        timeout: 5000,
                        rejectUnauthorized: false,
                        headers: {
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(payloadStr, 'utf8'),
                            'User-Agent': 'MeshCentral-mTicket-Sync/1.0'
                        }
                    };

                    var apiReq = https.request(options, function(apiRes) {});
                    apiReq.on('error', function(e) {});
                    apiReq.write(payloadStr);
                    apiReq.end();
                });
            });
        }
    };

    // ====================================================================
    // 3. BACK-END: CSV i TXT generiranje
    // ====================================================================
    obj.handleAdminReq = function(req, res, user) {
        if (req.query.download === 'csv' || req.query.download === 'ticket') {
            
            var nodeid = req.query.node;
            if (!nodeid) return res.status(400).send('Nedostaje Node ID u URL-u.');

            var sysid = nodeid.replace(/^node\/\//, 'si//');
            var swid  = nodeid.replace(/^node\/\//, 'sw//');

            var safeDbGet = function(id, callback) {
                if (typeof obj.meshServer.db.Get === 'function') obj.meshServer.db.Get(id, callback);
                else if (typeof obj.meshServer.db.get === 'function') obj.meshServer.db.get(id, callback);
                else callback("Nije pronađena db.Get funkcija", null);
            };

            safeDbGet(nodeid, function (err, nodes) {
                var node = null;
                if (Array.isArray(nodes) && nodes.length > 0) node = nodes[0];
                else if (nodes && !Array.isArray(nodes) && nodes._id) node = nodes;

                if (!node) return res.send("<h3>Računalo nije pronađeno u bazi!</h3>");

                safeDbGet(sysid, function (err, sysnodes) {
                    var sysinfo = null;
                    if (Array.isArray(sysnodes) && sysnodes.length > 0) sysinfo = sysnodes[0];
                    else if (sysnodes && !Array.isArray(sysnodes) && sysnodes._id) sysinfo = sysnodes;

                    safeDbGet(swid, function (err, swnodes) {
                        var software = null;
                        if (Array.isArray(swnodes) && swnodes.length > 0) software = swnodes[0];
                        else if (swnodes && !Array.isArray(swnodes) && swnodes._id) software = swnodes;

                        var hw = sysinfo ? (sysinfo.public || sysinfo.data || sysinfo.hwinfo || sysinfo) : (node.hwinfo || node.hardware || node.sysinfo);
                        var sw = software ? (software.public || software.data || software.apps || software.software || software) : (node.software || node.swinfo || node.apps);

                        var wsagents = obj.meshServer.webserver.wsagents;
                        if (wsagents && wsagents[nodeid]) {
                            if (!hw && wsagents[nodeid].hwinfo) hw = wsagents[nodeid].hwinfo;
                            if (!sw && wsagents[nodeid].software) sw = wsagents[nodeid].software;
                        }

                        var safeName = (node.name || 'racunalo').replace(/[^a-z0-9]/gi, '_').toLowerCase();

                        function formatBytes(bytes) {
                            if (!bytes || bytes === 0) return 'Nepoznato';
                            var gb = (bytes / (1024 * 1024 * 1024)).toFixed(2);
                            return gb + ' GB';
                        }
                        
                        function formatDrive(drive) {
                            if (!drive) return 'Nepoznat Disk';
                            var total = (drive.total / (1024*1024*1024)).toFixed(2);
                            var free = (drive.free / (1024*1024*1024)).toFixed(2);
                            return drive.name + " (" + total + " GB Ukupno, " + free + " GB Slobodno)";
                        }

                        if (req.query.download === 'csv') {
                            var csv = "Kategorija,Svojstvo,Vrijednost\n";
                            csv += `OSNOVNO,Ime,${node.name || 'Nepoznato'}\n`;
                            csv += `OSNOVNO,IP Adresa,${node.host || 'Offline'}\n`;
                            csv += `OSNOVNO,Operativni Sustav,${node.osdesc || node.mtype || 'Nepoznato'}\n`;
                            
                            if (hw) {
                                if (hw.bios && hw.bios.length > 0) csv += `HARDVER,Matična ploča,${hw.bios[0].board_name || 'Nepoznato'} (${hw.bios[0].board_vendor || ''})\n`;
                                if (hw.netinfo) csv += `HARDVER,RAM Memorija,${formatBytes(hw.netinfo.totalmem || hw.totalmem)}\n`;
                                
                                if (hw.cpu && hw.cpu.length > 0) {
                                    hw.cpu.forEach(function(cpu) {
                                        var cpuName = cpu.name ? cpu.name.replace(/,/g, ' ') : 'Nepoznati CPU';
                                        csv += `HARDVER,Procesor,${cpuName}\n`;
                                    });
                                }
                                if (hw.storage && hw.storage.length > 0) {
                                    hw.storage.forEach(function(hdd) {
                                        var diskName = formatDrive(hdd).replace(/,/g, ' ');
                                        csv += `HARDVER,Disk,${diskName}\n`;
                                    });
                                }
                                if (hw.netinfo && hw.netinfo.netifs && hw.netinfo.netifs.length > 0) {
                                    hw.netinfo.netifs.forEach(function(net) {
                                        if (net.mac && net.mac !== '00:00:00:00:00:00') {
                                            csv += `MREŽA,${net.name.replace(/,/g, ' ')},MAC: ${net.mac} | IPv4: ${net.ipv4 || 'Nema'}\n`;
                                        }
                                    });
                                }
                            } else {
                                csv += "HARDVER,Upozorenje,Nema hardverskih podataka u bazi ni u RAM-u\n";
                            }

                            if (sw) {
                                var swList = sw.apps || sw; 
                                if (Array.isArray(swList)) {
                                    swList.forEach(function(app) {
                                        var appName = (app.name || app.N || 'Nepoznato').replace(/,/g, ' '); 
                                        var appVer = (app.version || app.V || '').replace(/,/g, ' ');
                                        csv += `SOFTVER,${appName},${appVer}\n`;
                                    });
                                }
                            }

                            res.setHeader('Content-disposition', 'attachment; filename=' + safeName + '_export.csv');
                            res.setHeader('Content-type', 'text/csv; charset=utf-8');
                            res.send(csv);
                        } 
                        else if (req.query.download === 'ticket') {
                            var txt = "=== MESH CENTRAL TICKET EXPORT ===\n";
                            txt += "MC_NODE_ID: " + node._id + "\n";
                            txt += "HOSTNAME: " + (node.name || 'N/A') + "\n";
                            txt += "OS_TYPE: " + (node.osdesc || node.mtype || 'N/A') + "\n";
                            txt += "LAST_IP: " + (node.host || 'Offline') + "\n";
                            
                            if (hw) {
                                txt += "\n--- HARDWARE SUMMARY ---\n";
                                if (hw.cpu && hw.cpu[0]) txt += "CPU: " + hw.cpu[0].name + "\n";
                                if (hw.netinfo) txt += "RAM: " + formatBytes(hw.netinfo.totalmem || hw.totalmem) + "\n";
                                if (hw.storage) {
                                    for(var d=0; d<hw.storage.length; d++) {
                                        txt += "DRIVE_" + d + ": " + formatDrive(hw.storage[d]) + "\n";
                                    }
                                }
                                txt += "\n--- RAW HARDWARE JSON ---\n";
                                txt += JSON.stringify(hw, null, 2) + "\n";
                            } else {
                                txt += "\n--- HARDWARE ---\nNema hardverskih podataka u bazi ni u RAM-u.\n";
                            }

                            txt += "\n--- SOFTWARE ---\n";
                            if (sw) {
                                var swList = sw.apps || sw; 
                                if (Array.isArray(swList)) {
                                    for(var s=0; s<swList.length; s++) {
                                        txt += (swList[s].name || swList[s].N) + " (v" + (swList[s].version || swList[s].V || 'N/A') + ")\n";
                                    }
                                } else {
                                    txt += JSON.stringify(sw, null, 2) + "\n";
                                }
                            } else {
                                txt += "Nema softverskih podataka u bazi ni u RAM-u.\n";
                            }

                            txt += "\n=== END OF EXPORT ===\n";

                            res.setHeader('Content-disposition', 'attachment; filename=' + safeName + '_ticket.txt');
                            res.setHeader('Content-type', 'text/plain; charset=utf-8');
                            res.send(txt);
                        }
                    });
                });
            });
            return;
        }
        res.sendStatus(404);
    };

    return obj;
};