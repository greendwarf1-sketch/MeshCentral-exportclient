'use strict';
/**********************************************************************
 * Copyright (C) 2026 Mr. Green & MCS
 * exportclient.js - Unified Buttons & Smart DOM-Scraping Sync
 **********************************************************************/

module.exports.exportclient = function (parent) {
    var obj = {};
    obj.parent = parent;
    obj.meshServer = parent.parent;

    obj.exports = [
        'onDeviceRefreshEnd'
    ];

    // ====================================================================
    // 1. FRONT-END: Dinamičko postavljanje 3 tipke ovisno o aktivnom tabu
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

        // Brišemo staru grupu tipki ako postoji (kako se ne bi duplicirale kod refresha)
        var existingGroup = document.getElementById('mc-mticket-btn-group');
        if (existingGroup) existingGroup.remove();

        // Identificiramo elemente specifične za Software i Details tabove
        var softwareToolbar = document.querySelector('input[placeholder*="Search software"]');
        var detailsTable = document.getElementById('devdetailstable');

        // Provjeravamo koji je tab TRENUTNO vidljiv na ekranu
        var isSoftwareVisible = (softwareToolbar && softwareToolbar.offsetParent !== null);
        var isDetailsVisible = (detailsTable && detailsTable.offsetParent !== null);

        // Ako nismo ni na Software ni na Details tabu, prekidamo iscrtavanje
        if (!isSoftwareVisible && !isDetailsVisible) return;

        // Kreiramo glavni kontejner za sve 3 tipke
        var btnGroup = document.createElement('span');
        btnGroup.id = 'mc-mticket-btn-group';
        btnGroup.style.display = 'inline-block';
        
        // Prilagođavamo margine ovisno o tabu
        if (isSoftwareVisible) btnGroup.style.marginLeft = '15px';
        if (isDetailsVisible) btnGroup.style.marginBottom = '15px';

        // --- TIPKA 1: CSV ---
        var btnCsv = document.createElement('button');
        btnCsv.className = 'btn btn-secondary btn-sm';
        btnCsv.style.marginRight = '5px';
        btnCsv.innerHTML = '📥 Preuzmi CSV';
        btnCsv.onclick = function(e) { 
            e.preventDefault(); 
            triggerSilentDownload('/pluginadmin.ashx?pin=exportclient&download=csv&node=' + encodeURIComponent(nodeId)); 
        };

        // --- TIPKA 2: TXT ---
        var btnTxt = document.createElement('button');
        btnTxt.className = 'btn btn-primary btn-sm';
        btnTxt.style.marginRight = '5px';
        btnTxt.innerHTML = '🎫 Preuzmi TXT';
        btnTxt.onclick = function(e) { 
            e.preventDefault(); 
            triggerSilentDownload('/pluginadmin.ashx?pin=exportclient&download=ticket&node=' + encodeURIComponent(nodeId)); 
        };

        // --- TIPKA 3: API SYNC ---
        var btnSync = document.createElement('button');
        btnSync.className = 'btn btn-success btn-sm';
        btnSync.innerHTML = '🚀 Pošalji u mTicket';
        btnSync.onclick = function(e) {
            e.preventDefault();
            var btn = this;
            var originalText = btn.innerHTML;
            btn.innerHTML = '⏳ Čitanje...';
            btn.disabled = true;

            var extractedApps = [];
            
            // DOM SCRAPING: Čitamo samo ako smo na Software tabu gdje je tablica vidljiva
            if (isSoftwareVisible) {
                var rows = document.querySelectorAll('table tr, .table tr');
                for (var i = 0; i < rows.length; i++) {
                    var cols = rows[i].querySelectorAll('td');
                    if (cols.length >= 2 && cols[0].offsetParent !== null) { // Preskačemo skrivene redove
                        var appName = cols[0].innerText ? cols[0].innerText.trim() : '';
                        var appVer = cols[1].innerText ? cols[1].innerText.trim() : '';
                        if (appName && appName !== 'Name') {
                            extractedApps.push({ name: appName, version: appVer });
                        }
                    }
                }
            }

            // Traženje WebSocket veze
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
                    var appMsg = extractedApps.length > 0 ? ('\nPročitano ' + extractedApps.length + ' aplikacija.') : '';
                    alert('✅ Podaci su poslani u mTicket!' + appMsg);
                }, 1000);
            } else {
                btn.innerHTML = originalText;
                btn.disabled = false;
                alert('❌ Greška: Nema aktivne WebSocket veze.');
            }
        };

        // Ubacujemo tipke u kontejner
        btnGroup.appendChild(btnCsv);
        btnGroup.appendChild(btnTxt);
        btnGroup.appendChild(btnSync);

        // Pozicioniramo cijeli kontejner na pravu lokaciju
        if (isSoftwareVisible) {
            softwareToolbar.parentNode.appendChild(btnGroup);
        } else if (isDetailsVisible) {
            detailsTable.parentNode.insertBefore(btnGroup, detailsTable);
        }
    };

    // ====================================================================
    // 2. BACK-END ENGINE: Pametni prihvat i spajanje podataka
    // ====================================================================
    obj.serveraction = function (command, myparent, user) {
        if (command.action === 'plugin' && command.plugin === 'exportclient' && command.pluginaction === 'send_api_sync') {
            
            var nodeid = command.nodeId;
            if (!nodeid) return;

            var sysid = nodeid.replace(/^node\/\//, 'si//');
            var swid  = nodeid.replace(/^node\/\//, 'sw//');

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

                        // PAMETNI FALLBACK: Ako korisnik šalje iz "Details" taba, koristimo softver iz pozadine!
                        var finalSw = (command.scrapedSoftware && command.scrapedSoftware.length > 0) 
                            ? { apps: command.scrapedSoftware } 
                            : (sw || null);

                        var payloadObj = {
                            node_id: node._id,
                            name: node.name || 'Nepoznato',
                            os: node.osdesc || node.mtype || 'Nepoznato',
                            ip: node.host || 'Offline',
                            hardware: hw || null,
                            software: finalSw
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