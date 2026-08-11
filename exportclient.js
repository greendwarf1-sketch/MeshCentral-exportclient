'use strict';
/**********************************************************************
 * Copyright (C) 2026 Mr. Green & MCS
 * exportclient.js - Final Details Tab Fix
 **********************************************************************/

module.exports.exportclient = function (parent) {
    var obj = {};
    obj.parent = parent;
    obj.meshServer = parent.parent;
    obj.exportCache = {};

    obj.exports = [
        'onDeviceRefreshEnd'
    ];

    obj.onDeviceRefreshEnd = function () {
        if (window.mcsTicketWatchdog) clearInterval(window.mcsTicketWatchdog);

        window.mcsTicketWatchdog = setInterval(function() {
            if (typeof currentNode == 'undefined' || currentNode == null) return;
            var nodeId = currentNode._id;

            function triggerAction(actionType, context, btnObj) {
                var originalText = btnObj.innerHTML;
                btnObj.innerHTML = '⏳ Molim pričekajte...';
                btnObj.disabled = true;

                // 1. IZVLAČENJE SOFTVERA (Netaknuto, rekli smo da ovo radi)
                var sw = null;
                if (context === 'software') {
                    var extractedApps = [];
                    var rows = document.querySelectorAll('table tr, .table tr');
                    for (var i = 0; i < rows.length; i++) {
                        if (rows[i].offsetParent !== null) {
                            var cols = rows[i].querySelectorAll('td');
                            if (cols.length >= 2) {
                                var appName = cols[0].innerText ? cols[0].innerText.trim() : '';
                                var appVer = cols[1].innerText ? cols[1].innerText.trim() : '';
                                if (appName && appName !== 'Name' && appName !== 'Property' && appName !== 'General' && appName !== 'Platform') {
                                    extractedApps.push({ name: appName, version: appVer });
                                }
                            }
                        }
                    }
                    if (extractedApps.length > 0) sw = { apps: extractedApps };
                }

                // 2. IZVLAČENJE HARDVERA IZ DETAILS TABA (NOVA DOM SCRAPING LOGIKA)
                var hw = null;
                if (context === 'details') {
                    // Ako smo u details tabu, prvo probamo pokupiti podatke direktno s ekrana
                    var detailsTable = document.getElementById('devdetailstable');
                    if (detailsTable) {
                        var scrapedHw = { cpu: [], netinfo: { totalmem: 0, netifs: [] }, storage: [] };
                        var dtRows = detailsTable.querySelectorAll('tr');
                        
                        for (var j = 0; j < dtRows.length; j++) {
                            var dtCols = dtRows[j].querySelectorAll('td');
                            if (dtCols.length >= 2) {
                                var prop = dtCols[0].innerText ? dtCols[0].innerText.trim() : '';
                                var val = dtCols[1].innerText ? dtCols[1].innerText.trim() : '';
                                
                                // Detekcija memorije (prvo što se nađe s GB se sprema u bytes)
                                if (prop.indexOf('Memory') !== -1 && val.indexOf('GB') !== -1) {
                                     var gbVal = parseFloat(val.split(' ')[0]);
                                     if (!isNaN(gbVal)) scrapedHw.netinfo.totalmem = gbVal * 1024 * 1024 * 1024;
                                }
                                
                                // Detekcija procesora
                                if (prop.indexOf('Processor') !== -1) {
                                     scrapedHw.cpu.push({ name: val });
                                }
                                
                                // Detekcija diskova
                                if (prop.indexOf('Storage') !== -1 || (prop === '' && val.indexOf(':\\') !== -1)) {
                                     // Očekujemo format npr. "C:\ (200 GB Total, 100 GB Free)"
                                     var driveName = val.split(' ')[0] || 'Disk';
                                     scrapedHw.storage.push({ name: driveName, total: 0, free: 0, textDesc: val });
                                }
                                
                                // Detekcija mreže
                                if (prop.indexOf('Network') !== -1 || val.match(/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/)) {
                                      scrapedHw.netinfo.netifs.push({ name: 'Net', mac: val, ipv4: '' });
                                }
                            }
                        }
                        
                        // Ako smo išta ulovili sa ekrana, spremi
                        if (scrapedHw.cpu.length > 0 || scrapedHw.netinfo.totalmem > 0) {
                            hw = scrapedHw;
                        }
                    }
                }
                
                // 3. FALLBACK: Ako nema s ekrana, pokušaj iz RAM-a 
                if (!hw) {
                    if (typeof systemInfo !== 'undefined' && systemInfo[nodeId]) hw = systemInfo[nodeId];
                    else if (typeof currentNode !== 'undefined' && currentNode) hw = currentNode.hwinfo || currentNode.hardware || currentNode.sysinfo;
                }
                
                if (!sw && context !== 'software') {
                   if (typeof softwareInfo !== 'undefined' && softwareInfo[nodeId]) sw = softwareInfo[nodeId];
                   else if (typeof currentNode !== 'undefined' && currentNode) sw = currentNode.software || currentNode.swinfo || currentNode.apps;
                }


                var ws = null;
                if (typeof meshserver != 'undefined' && meshserver != null) ws = meshserver;
                else if (typeof server != 'undefined' && server != null) ws = server;
                else if (typeof window.meshserver != 'undefined' && window.meshserver != null) ws = window.meshserver;
                else if (typeof app != 'undefined' && app != null && app.server != null) ws = app.server;

                if (ws != null) {
                    if (actionType === 'mticket') {
                        ws.send({ action: 'plugin', plugin: 'exportclient', pluginaction: 'send_api_sync', nodeId: nodeId, hwData: hw, swData: sw });
                        setTimeout(function() {
                            btnObj.innerHTML = originalText;
                            btnObj.disabled = false;
                            alert('✅ Uspješno poslano u mTicket!');
                        }, 1000);
                    } else {
                        ws.send({ action: 'plugin', plugin: 'exportclient', pluginaction: 'cache_for_download', nodeId: nodeId, hwData: hw, swData: sw });
                        
                        setTimeout(function() {
                            var iframe = document.getElementById('exportHiddenFrame');
                            if (!iframe) {
                                iframe = document.createElement('iframe');
                                iframe.id = 'exportHiddenFrame';
                                iframe.style.display = 'none';
                                document.body.appendChild(iframe);
                            }
                            iframe.src = '/pluginadmin.ashx?pin=exportclient&download=' + actionType + '&node=' + encodeURIComponent(nodeId);
                            
                            btnObj.innerHTML = originalText;
                            btnObj.disabled = false;
                        }, 600);
                    }
                } else {
                    btnObj.innerHTML = originalText;
                    btnObj.disabled = false;
                    alert('❌ Greška: Nema aktivne WebSocket veze.');
                }
            }

            function buildButtonContainer(targetId, context) {
                var group = document.createElement('span');
                group.id = targetId;
                group.style.display = 'inline-block';
                group.style.verticalAlign = 'middle';

                var btnCsv = document.createElement('button');
                btnCsv.className = 'btn btn-secondary btn-sm';
                btnCsv.style.marginRight = '5px';
                btnCsv.innerHTML = '📥 Preuzmi CSV';
                btnCsv.onclick = function(e) { e.preventDefault(); triggerAction('csv', context, this); };

                var btnTxt = document.createElement('button');
                btnTxt.className = 'btn btn-primary btn-sm';
                btnTxt.style.marginRight = '5px';
                btnTxt.innerHTML = '🎫 Preuzmi TXT';
                btnTxt.onclick = function(e) { e.preventDefault(); triggerAction('ticket', context, this); };

                var syncBtn = document.createElement('button');
                syncBtn.className = 'btn btn-success btn-sm';
                syncBtn.innerHTML = '🚀 Pošalji u mTicket';
                syncBtn.onclick = function(e) { e.preventDefault(); triggerAction('mticket', context, this); };

                group.appendChild(btnCsv);
                group.appendChild(btnTxt);
                group.appendChild(syncBtn);
                return group;
            }

            var swSearch = document.querySelector('input[placeholder*="Search software"]');
            if (swSearch && swSearch.offsetParent !== null) {
                var swToolbar = swSearch.parentNode;
                if (!document.getElementById('mticket-btns-software')) {
                    var swGroup = buildButtonContainer('mticket-btns-software', 'software');
                    swGroup.style.marginLeft = '10px';
                    swToolbar.appendChild(swGroup);
                }
            }

            var detailsToolbar = document.getElementById('devListToolbarViewIcons3');
            if (detailsToolbar && detailsToolbar.offsetParent !== null) {
                if (!document.getElementById('mticket-btns-details')) {
                    var detailsGroup = buildButtonContainer('mticket-btns-details', 'details');
                    detailsGroup.style.marginRight = '15px'; 
                    detailsToolbar.insertBefore(detailsGroup, detailsToolbar.firstChild);
                }
            }

        }, 500); 
    };

    obj.serveraction = function (command, myparent, user) {
        if (command.action !== 'plugin' || command.plugin !== 'exportclient') return;
        var nodeid = command.nodeId;
        if (!nodeid) return;

        if (command.pluginaction === 'cache_for_download') {
            obj.exportCache[nodeid] = {
                hw: command.hwData,
                sw: command.swData
            };
            return;
        }

        if (command.pluginaction === 'send_api_sync') {
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

    obj.handleAdminReq = function(req, res, user) {
        if (req.query.download === 'csv' || req.query.download === 'ticket') {
            var nodeid = req.query.node;
            if (!nodeid) return res.status(400).send('Nedostaje Node ID.');

            var safeDbGet = function(id, callback) {
                if (typeof obj.meshServer.db.Get === 'function') obj.meshServer.db.Get(id, callback);
                else if (typeof obj.meshServer.db.get === 'function') obj.meshServer.db.get(id, callback);
                else callback("Nije pronađena db.Get funkcija", null);
            };

            safeDbGet(nodeid, function (err, nodes) {
                var node = null;
                if (Array.isArray(nodes) && nodes.length > 0) node = nodes[0];
                else if (nodes && !Array.isArray(nodes) && nodes._id) node = nodes;

                if (!node) return res.send("Računalo nije pronađeno.");

                // POVLAČENJE IZ CACHE-A
                var cachedData = obj.exportCache[nodeid] || { hw: null, sw: null };
                var hw = cachedData.hw;
                var sw = cachedData.sw;

                // FALLBACK NA BAZU AKO CACHE OMANE
                if (!hw || !sw) {
                     var sysid = nodeid.replace(/^node\/\//, 'si//');
                     var swid  = nodeid.replace(/^node\/\//, 'sw//');
                     
                     // Synchronous-like fallback behavior simulation
                     if (!hw && node.hwinfo) hw = node.hwinfo;
                     if (!sw && node.software) sw = node.software;
                }

                delete obj.exportCache[nodeid];

                var safeName = (node.name || 'racunalo').replace(/[^a-z0-9]/gi, '_').toLowerCase();

                function formatBytes(bytes) {
                    if (!bytes || bytes === 0) return 'Nepoznato';
                    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
                }
                function formatDrive(drive) {
                    if (!drive) return 'Nepoznat Disk';
                    if (drive.textDesc) return drive.textDesc; // Fallback for scraped drive
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
                        if (hw.netinfo && hw.netinfo.totalmem) csv += `HARDVER,RAM Memorija,${formatBytes(hw.netinfo.totalmem)}\n`;
                        
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
                        csv += "HARDVER,Upozorenje,Nema hardverskih podataka\n";
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
                        if (hw.netinfo && hw.netinfo.totalmem) txt += "RAM: " + formatBytes(hw.netinfo.totalmem) + "\n";
                        if (hw.storage) {
                            for(var d=0; d<hw.storage.length; d++) {
                                txt += "DRIVE_" + d + ": " + formatDrive(hw.storage[d]) + "\n";
                            }
                        }
                        txt += "\n--- RAW HARDWARE JSON ---\n";
                        txt += JSON.stringify(hw, null, 2) + "\n";
                    } else {
                        txt += "\n--- HARDWARE ---\nNema hardverskih podataka.\n";
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
                        txt += "Nema softverskih podataka.\n";
                    }

                    txt += "\n=== END OF EXPORT ===\n";

                    res.setHeader('Content-disposition', 'attachment; filename=' + safeName + '_ticket.txt');
                    res.setHeader('Content-type', 'text/plain; charset=utf-8');
                    res.send(txt);
                }
            });
            return;
        }
        res.sendStatus(404);
    };

    return obj;
};