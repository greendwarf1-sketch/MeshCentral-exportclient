'use strict';
/**********************************************************************
 * Copyright (C) 2026 Mr. Green & MCS
 * exportclient.js - Ultimate Client-Side Sync & Export (Full WebSocket)
 **********************************************************************/

module.exports.exportclient = function (parent) {
    var obj = {};
    obj.parent = parent;
    obj.meshServer = parent.parent;

    obj.exports = [
        'onDeviceRefreshEnd',
        'serveraction' // Moramo ovo dodati da bi frontend slušao odgovore s backenda!
    ];

    // ====================================================================
    // 1. FRONT-END: Puna detekcija, WebSocket Slanje i Primanje
    // ====================================================================
    obj.onDeviceRefreshEnd = function () {
        if (window.mcsTicketWatchdog) clearInterval(window.mcsTicketWatchdog);

        // Preklapanje MeshCentralove funkcije za primanje WebSocket poruka (samo za naš plugin)
        var originalServerAction = window.serveraction;
        window.serveraction = function (command) {
            // Ako je poruka od našeg plugina
            if (command && command.action === 'plugin' && command.plugin === 'exportclient' && command.pluginaction === 'download_file') {
                
                var btn = document.getElementById(command.btnId);
                if (btn) {
                    btn.innerHTML = btn.getAttribute('data-original-text');
                    btn.disabled = false;
                }

                // Generiranje datoteke u pregledniku i automatsko preuzimanje
                var blob = new Blob([command.content], { type: 'text/plain;charset=utf-8' });
                var url = window.URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = command.filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
                
                return; // Prekidamo izvršavanje kako ne bi išlo u originalnu funkciju
            }
            
            // Za sve ostale MeshCentral poruke, pozovi originalnu funkciju
            if (typeof originalServerAction === 'function') {
                originalServerAction(command);
            }
        };

        window.mcsTicketWatchdog = setInterval(function() {
            if (typeof currentNode == 'undefined' || currentNode == null) return;
            var nodeId = currentNode._id;

            // PAMETNO ČITANJE HARDVERA
            function getHardware() {
                if (typeof systemInfo !== 'undefined' && systemInfo[nodeId]) return systemInfo[nodeId];
                if (typeof currentNode !== 'undefined' && currentNode) return currentNode.hwinfo || currentNode.hardware || currentNode.sysinfo;
                return null;
            }

            // PAMETNO ČITANJE SOFTVERA
            function getSoftware() {
                var extractedApps = [];
                var rows = document.querySelectorAll('table tr, .table tr');
                for (var i = 0; i < rows.length; i++) {
                    if (rows[i].offsetParent !== null) {
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
                if (extractedApps.length > 0) return { apps: extractedApps };
                
                if (typeof softwareInfo !== 'undefined' && softwareInfo[nodeId]) return softwareInfo[nodeId];
                if (typeof currentNode !== 'undefined' && currentNode) return currentNode.software || currentNode.swinfo || currentNode.apps;
                return null;
            }

            // FUNKCIJA KOJA SVE ŠALJE U WEBSOCKET
            function triggerAction(actionType, btnObj, targetActionStr) {
                var originalText = btnObj.innerHTML;
                btnObj.setAttribute('data-original-text', originalText);
                btnObj.innerHTML = '⏳ ' + targetActionStr + '...';
                btnObj.disabled = true;

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
                        pluginaction: actionType,
                        nodeId: nodeId,
                        nodeName: currentNode.name || 'racunalo',
                        btnId: btnObj.id, // Šaljemo ID gumba da ga backend vrati nazad
                        hwData: hw,
                        swData: sw
                    });
                    
                    if (actionType === 'send_api_sync') {
                        setTimeout(function() {
                            btnObj.innerHTML = originalText;
                            btnObj.disabled = false;
                            var swCount = (sw && sw.apps) ? sw.apps.length : 0;
                            var msg = swCount > 0 ? ('\nZapakirano ' + swCount + ' aplikacija.') : '';
                            alert('✅ Uspješno poslano u mTicket!' + msg);
                        }, 1000);
                    }
                } else {
                    btnObj.innerHTML = originalText;
                    btnObj.disabled = false;
                    alert('❌ Greška: Nema aktivne WebSocket veze.');
                }
            }

            function buildButtonContainer(targetId) {
                var group = document.createElement('span');
                group.id = targetId;
                group.style.display = 'inline-block';
                group.style.verticalAlign = 'middle';

                // Generiramo unikatne ID-jeve za tipke kako bi im backend mogao odgovoriti
                var uniqueSuffix = Math.random().toString(36).substring(7);

                var btnCsv = document.createElement('button');
                btnCsv.id = 'btn-csv-' + uniqueSuffix;
                btnCsv.className = 'btn btn-secondary btn-sm';
                btnCsv.style.marginRight = '5px';
                btnCsv.innerHTML = '📥 Preuzmi CSV';
                btnCsv.onclick = function(e) { e.preventDefault(); triggerAction('generate_csv', this, 'Generiranje'); };

                var btnTxt = document.createElement('button');
                btnTxt.id = 'btn-txt-' + uniqueSuffix;
                btnTxt.className = 'btn btn-primary btn-sm';
                btnTxt.style.marginRight = '5px';
                btnTxt.innerHTML = '🎫 Preuzmi TXT';
                btnTxt.onclick = function(e) { e.preventDefault(); triggerAction('generate_ticket', this, 'Generiranje'); };

                var syncBtn = document.createElement('button');
                syncBtn.id = 'btn-sync-' + uniqueSuffix;
                syncBtn.className = 'btn btn-success btn-sm';
                syncBtn.innerHTML = '🚀 Pošalji u mTicket';
                syncBtn.onclick = function(e) { e.preventDefault(); triggerAction('send_api_sync', this, 'Slanje'); };

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
    // 2. BACK-END ENGINE: Prihvat iz WebSocketa (mTicket slanje & Izrada fajlova)
    // ====================================================================
    obj.serveraction = function (command, myparent, user) {
        if (command.action !== 'plugin' || command.plugin !== 'exportclient') return;
        
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

                    // Apsolutni prioritet ima klijent (Frontend), on šalje pune podatke!
                    var finalHw = command.hwData || (sysinfo ? (sysinfo.public || sysinfo.data || sysinfo.hwinfo || sysinfo) : (node.hwinfo || node.hardware || node.sysinfo));
                    var finalSw = command.swData || (software ? (software.public || software.data || software.apps || software.software || software) : (node.software || node.swinfo || node.apps));

                    var wsagents = obj.meshServer.webserver.wsagents;
                    if (wsagents && wsagents[nodeid]) {
                        if (!finalHw && wsagents[nodeid].hwinfo) finalHw = wsagents[nodeid].hwinfo;
                        if (!finalSw && wsagents[nodeid].software) finalSw = wsagents[nodeid].software;
                    }

                    // -------------------------------------------------------------
                    // AKCIJA 1: SLANJE U MTICKET
                    // -------------------------------------------------------------
                    if (command.pluginaction === 'send_api_sync') {
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
                    }

                    // -------------------------------------------------------------
                    // Pomoćne funkcije za formatiranje datoteka
                    // -------------------------------------------------------------
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
                    var safeName = (node.name || 'racunalo').replace(/[^a-z0-9]/gi, '_').toLowerCase();

                    // -------------------------------------------------------------
                    // AKCIJA 2: KREIRANJE CSV-a U POZADINI I SLANJE NATRAG (WEBSOCKET)
                    // -------------------------------------------------------------
                    if (command.pluginaction === 'generate_csv') {
                        var csv = "Kategorija,Svojstvo,Vrijednost\n";
                        csv += `OSNOVNO,Ime,${node.name || 'Nepoznato'}\n`;
                        csv += `OSNOVNO,IP Adresa,${node.host || 'Offline'}\n`;
                        csv += `OSNOVNO,Operativni Sustav,${node.osdesc || node.mtype || 'Nepoznato'}\n`;
                        
                        if (finalHw) {
                            if (finalHw.bios && finalHw.bios.length > 0) csv += `HARDVER,Matična ploča,${finalHw.bios[0].board_name || 'Nepoznato'} (${finalHw.bios[0].board_vendor || ''})\n`;
                            if (finalHw.netinfo) csv += `HARDVER,RAM Memorija,${formatBytes(finalHw.netinfo.totalmem || finalHw.totalmem)}\n`;
                            
                            if (finalHw.cpu && finalHw.cpu.length > 0) {
                                finalHw.cpu.forEach(function(cpu) {
                                    var cpuName = cpu.name ? cpu.name.replace(/,/g, ' ') : 'Nepoznati CPU';
                                    csv += `HARDVER,Procesor,${cpuName}\n`;
                                });
                            }
                            if (finalHw.storage && finalHw.storage.length > 0) {
                                finalHw.storage.forEach(function(hdd) {
                                    var diskName = formatDrive(hdd).replace(/,/g, ' ');
                                    csv += `HARDVER,Disk,${diskName}\n`;
                                });
                            }
                            if (finalHw.netinfo && finalHw.netinfo.netifs && finalHw.netinfo.netifs.length > 0) {
                                finalHw.netinfo.netifs.forEach(function(net) {
                                    if (net.mac && net.mac !== '00:00:00:00:00:00') {
                                        csv += `MREŽA,${net.name.replace(/,/g, ' ')},MAC: ${net.mac} | IPv4: ${net.ipv4 || 'Nema'}\n`;
                                    }
                                });
                            }
                        } else {
                            csv += "HARDVER,Upozorenje,Nema hardverskih podataka\n";
                        }

                        if (finalSw) {
                            var swList = finalSw.apps || finalSw; 
                            if (Array.isArray(swList)) {
                                swList.forEach(function(app) {
                                    var appName = (app.name || app.N || 'Nepoznato').replace(/,/g, ' '); 
                                    var appVer = (app.version || app.V || '').replace(/,/g, ' ');
                                    csv += `SOFTVER,${appName},${appVer}\n`;
                                });
                            }
                        }

                        // Vraćamo datoteku klijentu KROZ WEBSOCKET TUNEL!
                        try {
                            myparent.send(JSON.stringify({ 
                                action: 'plugin', 
                                plugin: 'exportclient', 
                                pluginaction: 'download_file',
                                btnId: command.btnId,
                                filename: safeName + '_export.csv',
                                content: csv
                            }));
                        } catch(e) {}
                    }

                    // -------------------------------------------------------------
                    // AKCIJA 3: KREIRANJE TXT-a U POZADINI I SLANJE NATRAG (WEBSOCKET)
                    // -------------------------------------------------------------
                    if (command.pluginaction === 'generate_ticket') {
                        var txt = "=== MESH CENTRAL TICKET EXPORT ===\n";
                        txt += "MC_NODE_ID: " + node._id + "\n";
                        txt += "HOSTNAME: " + (node.name || 'N/A') + "\n";
                        txt += "OS_TYPE: " + (node.osdesc || node.mtype || 'N/A') + "\n";
                        txt += "LAST_IP: " + (node.host || 'Offline') + "\n";
                        
                        if (finalHw) {
                            txt += "\n--- HARDWARE SUMMARY ---\n";
                            if (finalHw.cpu && finalHw.cpu[0]) txt += "CPU: " + finalHw.cpu[0].name + "\n";
                            if (finalHw.netinfo) txt += "RAM: " + formatBytes(finalHw.netinfo.totalmem || finalHw.totalmem) + "\n";
                            if (finalHw.storage) {
                                for(var d=0; d<finalHw.storage.length; d++) {
                                    txt += "DRIVE_" + d + ": " + formatDrive(finalHw.storage[d]) + "\n";
                                }
                            }
                            txt += "\n--- RAW HARDWARE JSON ---\n";
                            txt += JSON.stringify(finalHw, null, 2) + "\n";
                        } else {
                            txt += "\n--- HARDWARE ---\nNema hardverskih podataka.\n";
                        }

                        txt += "\n--- SOFTWARE ---\n";
                        if (finalSw) {
                            var swList = finalSw.apps || finalSw; 
                            if (Array.isArray(swList)) {
                                for(var s=0; s<swList.length; s++) {
                                    txt += (swList[s].name || swList[s].N) + " (v" + (swList[s].version || swList[s].V || 'N/A') + ")\n";
                                }
                            } else {
                                txt += JSON.stringify(finalSw, null, 2) + "\n";
                            }
                        } else {
                            txt += "Nema softverskih podataka.\n";
                        }

                        txt += "\n=== END OF EXPORT ===\n";

                        // Vraćamo datoteku klijentu KROZ WEBSOCKET TUNEL!
                        try {
                            myparent.send(JSON.stringify({ 
                                action: 'plugin', 
                                plugin: 'exportclient', 
                                pluginaction: 'download_file',
                                btnId: command.btnId,
                                filename: safeName + '_ticket.txt',
                                content: txt
                            }));
                        } catch(e) {}
                    }

                });
            });
        });
    };

    // Stari HTTP handler više ne trebamo za preuzimanje datoteka, sve ide kroz WebSocket.
    obj.handleAdminReq = function(req, res, user) {
        res.sendStatus(404);
    };

    return obj;
};