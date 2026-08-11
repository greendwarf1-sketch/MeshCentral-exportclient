'use strict';
/**********************************************************************
 * Copyright (C) 2026 Mr. Green & MCS
 * exportclient.js - Ultimate Client-Side Sync & Export
 **********************************************************************/

module.exports.exportclient = function (parent) {
    var obj = {};
    obj.parent = parent;
    obj.meshServer = parent.parent;

    obj.exports = [
        'onDeviceRefreshEnd'
    ];

    // ====================================================================
    // 1. FRONT-END: Puna detekcija Hardvera/Softvera i POST Export
    // ====================================================================
    obj.onDeviceRefreshEnd = function () {
        if (window.mcsTicketWatchdog) clearInterval(window.mcsTicketWatchdog);

        window.mcsTicketWatchdog = setInterval(function() {
            if (typeof currentNode == 'undefined' || currentNode == null) return;
            var nodeId = currentNode._id;

            // PAMETNO ČITANJE HARDVERA IZ PREGLEDNIKA
            function getHardware() {
                if (typeof systemInfo !== 'undefined' && systemInfo[nodeId]) return systemInfo[nodeId];
                if (typeof currentNode !== 'undefined' && currentNode) return currentNode.hwinfo || currentNode.hardware || currentNode.sysinfo;
                return null;
            }

            // PAMETNO ČITANJE SOFTVERA (Prvo DOM tablica, pa onda RAM)
            function getSoftware() {
                var extractedApps = [];
                var rows = document.querySelectorAll('table tr, .table tr');
                for (var i = 0; i < rows.length; i++) {
                    if (rows[i].offsetParent !== null) { // Samo vidljivi redovi
                        var cols = rows[i].querySelectorAll('td');
                        if (cols.length >= 2) {
                            var appName = cols[0].innerText ? cols[0].innerText.trim() : '';
                            var appVer = cols[1].innerText ? cols[1].innerText.trim() : '';
                            if (appName && appName !== 'Name' && appName !== 'Property') {
                                extractedApps.push({ name: appName, version: appVer });
                            }
                        }
                    }
                }
                // Ako smo pronašli tablicu na ekranu
                if (extractedApps.length > 0) return { apps: extractedApps };
                
                // Ako tablica nije vidljiva (npr. na smo Details tabu), čupaj iz RAM-a!
                if (typeof softwareInfo !== 'undefined' && softwareInfo[nodeId]) return softwareInfo[nodeId];
                if (typeof currentNode !== 'undefined' && currentNode) return currentNode.software || currentNode.swinfo || currentNode.apps;
                
                return null;
            }

            // FUNKCIJA ZA PREUZIMANJE DATOTEKA SA SLANJEM CIJELOG RAM-A
            function triggerPostDownload(type, btnObj) {
                var originalText = btnObj.innerHTML;
                btnObj.innerHTML = '⏳ Generiranje...';
                btnObj.disabled = true;

                var payload = {
                    nodeId: nodeId,
                    hwData: getHardware(),
                    swData: getSoftware()
                };

                fetch('/pluginadmin.ashx?pin=exportclient&action=download&type=' + type, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                .then(function(res) {
                    if (!res.ok) throw new Error("HTTP " + res.status);
                    var disp = res.headers.get('Content-Disposition') || '';
                    var filename = 'export_' + type + (type === 'csv' ? '.csv' : '.txt');
                    if (disp && disp.indexOf('filename=') !== -1) {
                        filename = disp.split('filename=')[1].replace(/"/g, '');
                    }
                    return res.blob().then(function(blob) { return { blob: blob, filename: filename }; });
                })
                .then(function(data) {
                    var url = window.URL.createObjectURL(data.blob);
                    var a = document.createElement('a');
                    a.href = url;
                    a.download = data.filename;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                    
                    btnObj.innerHTML = originalText;
                    btnObj.disabled = false;
                })
                .catch(function(err) {
                    btnObj.innerHTML = originalText;
                    btnObj.disabled = false;
                    alert("❌ Greška pri preuzimanju: " + err.message);
                });
            }

            function buildButtonContainer(targetId) {
                var group = document.createElement('span');
                group.id = targetId;
                group.style.display = 'inline-block';
                group.style.verticalAlign = 'middle';

                var btnCsv = document.createElement('button');
                btnCsv.className = 'btn btn-secondary btn-sm';
                btnCsv.style.marginRight = '5px';
                btnCsv.innerHTML = '📥 Preuzmi CSV';
                btnCsv.onclick = function(e) { e.preventDefault(); triggerPostDownload('csv', this); };

                var btnTxt = document.createElement('button');
                btnTxt.className = 'btn btn-primary btn-sm';
                btnTxt.style.marginRight = '5px';
                btnTxt.innerHTML = '🎫 Preuzmi TXT';
                btnTxt.onclick = function(e) { e.preventDefault(); triggerPostDownload('ticket', this); };

                var syncBtn = document.createElement('button');
                syncBtn.className = 'btn btn-success btn-sm';
                syncBtn.innerHTML = '🚀 Pošalji u mTicket';
                
                syncBtn.onclick = function(e) {
                    e.preventDefault();
                    var btn = this;
                    var originalText = btn.innerHTML;
                    btn.innerHTML = '⏳ Čitanje...';
                    btn.disabled = true;

                    var hw = getHardware();
                    var sw = getSoftware();

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
                            hwData: hw,
                            swData: sw
                        });
                        
                        setTimeout(function() {
                            btn.innerHTML = originalText;
                            btn.disabled = false;
                            var swCount = (sw && sw.apps) ? sw.apps.length : 0;
                            var msg = swCount > 0 ? ('\nZapakirano ' + swCount + ' aplikacija.') : '';
                            alert('✅ Uspješno poslano u mTicket!' + msg);
                        }, 1000);
                    } else {
                        btn.innerHTML = originalText;
                        btn.disabled = false;
                        alert('❌ Greška: Nema aktivne WebSocket veze.');
                    }
                };

                group.appendChild(btnCsv);
                group.appendChild(btnTxt);
                group.appendChild(syncBtn);
                return group;
            }

            // LOKACIJA 1: SOFTWARE TAB
            var softwareSearch = document.querySelector('input[placeholder*="Search software"]');
            if (softwareSearch && softwareSearch.offsetParent !== null) {
                var swToolbar = softwareSearch.parentNode;
                if (!document.getElementById('mticket-btns-software')) {
                    var swGroup = buildButtonContainer('mticket-btns-software');
                    swGroup.style.marginLeft = '10px';
                    swToolbar.appendChild(swGroup);
                }
            }

            // LOKACIJA 2: DETAILS TAB
            var detailsToolbar = document.getElementById('devListToolbarViewIcons3');
            if (detailsToolbar && detailsToolbar.offsetParent !== null) {
                if (!document.getElementById('mticket-btns-details')) {
                    var detailsGroup = buildButtonContainer('mticket-btns-details');
                    detailsGroup.style.marginRight = '15px'; 
                    detailsToolbar.insertBefore(detailsGroup, detailsToolbar.firstChild);
                }
            }

        }, 500); 
    };

    // ====================================================================
    // 2. BACK-END ENGINE: Prihvat podataka s Klijenta (WebSocket)
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

                        // Klijent (Frontend) je apsolutni kralj. Ako on pošalje, koristimo to!
                        var finalHw = command.hwData || (sysinfo ? (sysinfo.public || sysinfo.data || sysinfo.hwinfo || sysinfo) : (node.hwinfo || node.hardware || node.sysinfo));
                        var finalSw = command.swData || (software ? (software.public || software.data || software.apps || software.software || software) : (node.software || node.swinfo || node.apps));

                        var wsagents = obj.meshServer.webserver.wsagents;
                        if (wsagents && wsagents[nodeid]) {
                            if (!finalHw && wsagents[nodeid].hwinfo) finalHw = wsagents[nodeid].hwinfo;
                            if (!finalSw && wsagents[nodeid].software) finalSw = wsagents[nodeid].software;
                        }

                        var payloadObj = {
                            node_id: node._id,
                            name: node.name || 'Nepoznato',
                            os: node.osdesc || node.mtype || 'Nepoznato',
                            ip: node.host || 'Offline',
                            hardware: finalHw || null,
                            software: finalSw || null
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
    // 3. BACK-END: Generiranje datoteka (Klijent šalje POST podatke)
    // ====================================================================
    obj.handleAdminReq = function(req, res, user) {
        if (req.method === 'POST' && req.query.action === 'download') {
            var bodyData = '';
            req.on('data', function(chunk) { bodyData += chunk; });
            req.on('end', function() {
                try {
                    var parsedBody = JSON.parse(bodyData);
                    var nodeid = parsedBody.nodeId;
                    var type = req.query.type;

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

                        if (!node) return res.status(404).send("Node not found");

                        safeDbGet(sysid, function (err, sysnodes) {
                            var sysinfo = null;
                            if (Array.isArray(sysnodes) && sysnodes.length > 0) sysinfo = sysnodes[0];
                            else if (sysnodes && !Array.isArray(sysnodes) && sysnodes._id) sysinfo = sysnodes;

                            safeDbGet(swid, function (err, swnodes) {
                                var software = null;
                                if (Array.isArray(swnodes) && swnodes.length > 0) software = swnodes[0];
                                else if (swnodes && !Array.isArray(swnodes) && swnodes._id) software = swnodes;

                                // Prioritet imaju podaci s Klijentovog ekrana/RAM-a
                                var hw = parsedBody.hwData || (sysinfo ? (sysinfo.public || sysinfo.data || sysinfo.hwinfo || sysinfo) : (node.hwinfo || node.hardware || node.sysinfo));
                                var sw = parsedBody.swData || (software ? (software.public || software.data || software.apps || software.software || software) : (node.software || node.swinfo || node.apps));

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

                                if (type === 'csv') {
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

                                    res.setHeader('Content-disposition', 'attachment; filename="' + safeName + '_export.csv"');
                                    res.setHeader('Content-type', 'text/csv; charset=utf-8');
                                    res.send(csv);
                                } 
                                else if (type === 'ticket') {
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

                                    res.setHeader('Content-disposition', 'attachment; filename="' + safeName + '_ticket.txt"');
                                    res.setHeader('Content-type', 'text/plain; charset=utf-8');
                                    res.send(txt);
                                }
                            });
                        });
                    });
                } catch(e) {
                    res.status(500).send("Parse error");
                }
            });
            return;
        }
        res.sendStatus(404);
    };

    return obj;
};