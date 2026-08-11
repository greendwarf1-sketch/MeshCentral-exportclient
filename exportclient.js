'use strict';
/**********************************************************************
 * Copyright (C) 2026 Mr. Green & MCS
 * exportclient.js - Ultimate Local-Render, Refresh Trigger & DOM Scraping
 **********************************************************************/

module.exports.exportclient = function (parent) {
    var obj = {};
    obj.parent = parent;
    obj.meshServer = parent.parent;

    obj.exports = [
        'onDeviceRefreshEnd'
    ];

    // ====================================================================
    // 1. FRONT-END: Auto-Discovery, Refresh Trigger & Local File Export
    // ====================================================================
    obj.onDeviceRefreshEnd = function () {
        if (window.mcsTicketWatchdog) clearInterval(window.mcsTicketWatchdog);

        window.mcsTicketWatchdog = setInterval(function() {
            if (typeof currentNode == 'undefined' || currentNode == null) return;
            var nodeId = currentNode._id;
            var nodeName = currentNode.name || 'Racunalo';
            var nodeOs = currentNode.osdesc || currentNode.mtype || 'Nepoznato';
            var nodeIp = currentNode.host || 'Offline';
            var safeName = nodeName.replace(/[^a-z0-9]/gi, '_').toLowerCase();

            // IDEJA: Pokretanje MeshCentral nativnog Refresh gumba
            function triggerNativeRefresh() {
                try {
                    if (typeof refreshDetails === 'function') {
                        refreshDetails();
                        return true;
                    }
                    var refreshElem = document.querySelector('#devListToolbarViewIcons3 svg, #devListToolbarViewIcons3 i, [onclick*="refreshDetails"]');
                    if (refreshElem) {
                        refreshElem.click();
                        return true;
                    }
                } catch(e) {}
                return false;
            }

            // Čitanje Hardvera iz Details DOM-a (#p17info / #p17)
            function scrapeDetailsDOM() {
                var container = document.getElementById('p17info') || document.getElementById('p17') || document.getElementById('devdetailstable');
                if (!container) return null;

                var text = container.innerText || container.textContent || '';
                if (!text || text.length < 30) return null;

                var scrapedHw = {
                    bios: [],
                    cpu: [],
                    netinfo: { totalmem: 0, netifs: [] },
                    storage: []
                };

                // Procesor
                var cpuMatch = text.match(/CPU\s*\n?\s*([^\n]+)/i) || text.match(/Processor\s*\n?\s*([^\n]+)/i);
                if (cpuMatch && cpuMatch[1]) {
                    scrapedHw.cpu.push({ name: cpuMatch[1].trim() });
                }

                // Matična ploča / BIOS
                var mbVendor = text.match(/Motherboard[\s\S]*?Vendor\s*\n?\s*([^\n]+)/i);
                var mbName = text.match(/Motherboard[\s\S]*?Name\s*\n?\s*([^\n]+)/i);
                var biosVendor = text.match(/BIOS[\s\S]*?Vendor\s*\n?\s*([^\n]+)/i);

                if (mbName || mbVendor || biosVendor) {
                    scrapedHw.bios.push({
                        board_name: mbName ? mbName[1].trim() : (biosVendor ? biosVendor[1].trim() : 'Matična ploča'),
                        board_vendor: mbVendor ? mbVendor[1].trim() : (biosVendor ? biosVendor[1].trim() : '')
                    });
                }

                // RAM Memorija (zbroj iz keksa ili direktno)
                var memMatches = text.matchAll(/Capacity(?:\s*[\/:]\s*Speed)?\s*\n?\s*"?(\d+)\s*Mb/gi);
                var totalMb = 0;
                for (var match of memMatches) {
                    totalMb += parseInt(match[1], 10);
                }
                if (totalMb > 0) {
                    scrapedHw.netinfo.totalmem = totalMb * 1024 * 1024; // MB u Bytes
                } else {
                    var ramGb = text.match(/Memory[\s\S]*?(\d+(?:\.\d+)?)\s*GB/i);
                    if (ramGb) scrapedHw.netinfo.totalmem = parseFloat(ramGb[1]) * 1024 * 1024 * 1024;
                }

                // Diskovi i Particije
                var volMatches = text.matchAll(/([A-Z]:)\s*\n?\s*Capacity\s*\n?\s*([\d\.]+\s*GB)[\s\S]*?Capacity\s*Remaining\s*\n?\s*([\d\.]+\s*GB)/gi);
                for (var vol of volMatches) {
                    scrapedHw.storage.push({
                        name: vol[1],
                        textDesc: vol[1] + " (" + vol[2] + " Ukupno, " + vol[3] + " Slobodno)"
                    });
                }

                var diskMatches = text.matchAll(/(Kingmax|WDC|Western|Samsung|Seagate|Crucial|SanDisk|SSD|HDD)[^\n]*/gi);
                for (var disk of diskMatches) {
                    var dName = disk[0].trim();
                    if (dName.length > 3 && !dName.match(/Storage Volumes/i)) {
                        scrapedHw.storage.push({ name: dName, textDesc: dName });
                    }
                }

                // Mreža
                var netMatches = text.matchAll(/([A-Za-z0-9\s_\-]+)\s*\n?\s*MAC Layer\s*\n?\s*MAC:\s*([0-9A-Fa-f:]+)[\s\S]*?IPv4 Layer\s*\n?\s*IP:\s*([\d\.\,\s]+)/gi);
                for (var net of netMatches) {
                    scrapedHw.netinfo.netifs.push({
                        name: net[1].trim(),
                        mac: net[2].trim(),
                        ipv4: net[3].trim()
                    });
                }

                return (scrapedHw.cpu.length > 0 || scrapedHw.storage.length > 0 || scrapedHw.netinfo.totalmem > 0) ? scrapedHw : null;
            }

            // Lovac na Hardver iz RAM-a (Fallback)
            function getHardwareFromRAM() {
                for (var key in window) {
                    try {
                        if (window[key] && typeof window[key] === 'object' && window[key][nodeId]) {
                            var val = window[key][nodeId];
                            if (val && typeof val === 'object' && (val.cpu || val.netinfo || val.bios || val.motherboard)) {
                                return val;
                            }
                        }
                    } catch(e) {}
                }
                return null;
            }

            // Lovac na Softver iz RAM-a (Fallback)
            function getSoftwareFromRAM() {
                for (var key in window) {
                    try {
                        if (window[key] && typeof window[key] === 'object' && window[key][nodeId]) {
                            var val = window[key][nodeId];
                            if (val && typeof val === 'object') {
                                if (Array.isArray(val) && val.length > 5 && val[0].name) return { apps: val };
                                if (val.apps && Array.isArray(val.apps)) return val;
                            }
                        }
                    } catch(e) {}
                }
                return null;
            }

            // NETAKNUTO: Software DOM Scraping koji već savršeno radi!
            function scrapeSoftwareDOM() {
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
                return extractedApps.length > 0 ? { apps: extractedApps } : getSoftwareFromRAM();
            }

            function formatBytes(bytes) {
                if (!bytes || bytes === 0) return 'Nepoznato';
                return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
            }
            
            function formatDrive(drive) {
                if (!drive) return 'Nepoznat Disk';
                if (drive.textDesc) return drive.textDesc; 
                var total = drive.total ? (drive.total / (1024*1024*1024)).toFixed(2) : 0;
                var free = drive.free ? (drive.free / (1024*1024*1024)).toFixed(2) : 0;
                return drive.name + " (" + total + " GB Ukupno, " + free + " GB Slobodno)";
            }

            function downloadBlob(content, fileName, mimeType) {
                var blob = new Blob([content], { type: mimeType });
                var url = window.URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
            }

            function triggerAction(actionType, context, btnObj) {
                var originalText = btnObj.innerHTML;
                btnObj.innerHTML = '⏳ Čitanje...';
                btnObj.disabled = true;

                // Ako smo u Details tabu, za svaki slučaj okinemo i nativni Refresh!
                if (context === 'details') {
                    triggerNativeRefresh();
                }

                // Odgađamo skupljanje za 150ms ako je okinut refresh, da se DOM stabilizira
                setTimeout(function() {
                    var hw = (context === 'details') ? (scrapeDetailsDOM() || getHardwareFromRAM()) : getHardwareFromRAM();
                    var sw = (context === 'software') ? scrapeSoftwareDOM() : getSoftwareFromRAM();

                    // 1. GENERIRANJE CSV-A LOKALNO
                    if (actionType === 'csv') {
                        var csv = "Kategorija,Svojstvo,Vrijednost\n";
                        csv += `OSNOVNO,Ime,${nodeName}\nOSNOVNO,IP Adresa,${nodeIp}\nOSNOVNO,Operativni Sustav,${nodeOs}\n`;
                        if (hw) {
                            if (hw.bios && hw.bios.length > 0) csv += `HARDVER,Matična ploča,${hw.bios[0].board_name || 'Nepoznato'} (${hw.bios[0].board_vendor || ''})\n`;
                            if (hw.netinfo && hw.netinfo.totalmem) csv += `HARDVER,RAM Memorija,${formatBytes(hw.netinfo.totalmem)}\n`;
                            if (hw.cpu && hw.cpu.length > 0) hw.cpu.forEach(function(c) { csv += `HARDVER,Procesor,${c.name ? c.name.replace(/,/g, ' ') : 'CPU'}\n`; });
                            if (hw.storage && hw.storage.length > 0) hw.storage.forEach(function(d) { csv += `HARDVER,Disk,${formatDrive(d).replace(/,/g, ' ')}\n`; });
                            if (hw.netinfo && hw.netinfo.netifs && hw.netinfo.netifs.length > 0) hw.netinfo.netifs.forEach(function(n) { if (n.mac && n.mac !== '00:00:00:00:00:00') csv += `MREŽA,${n.name ? n.name.replace(/,/g, ' ') : 'Net'},MAC: ${n.mac} | IPv4: ${n.ipv4 || 'Nema'}\n`; });
                        } else csv += "HARDVER,Upozorenje,Nema hardverskih podataka u memoriji\n";

                        if (sw) {
                            var swList = sw.apps || sw; 
                            if (Array.isArray(swList)) swList.forEach(function(a) { csv += `SOFTVER,${(a.name || a.N || 'Nepoznato').replace(/,/g, ' ')},${(a.version || a.V || '').replace(/,/g, ' ')}\n`; });
                        }
                        
                        downloadBlob(csv, safeName + '_export.csv', 'text/csv;charset=utf-8');
                        btnObj.innerHTML = originalText;
                        btnObj.disabled = false;
                    } 
                    // 2. GENERIRANJE TXT-A LOKALNO
                    else if (actionType === 'ticket') {
                        var txt = "=== MESH CENTRAL TICKET EXPORT ===\n";
                        txt += `MC_NODE_ID: ${nodeId}\nHOSTNAME: ${nodeName}\nOS_TYPE: ${nodeOs}\nLAST_IP: ${nodeIp}\n`;
                        if (hw) {
                            txt += "\n--- HARDWARE SUMMARY ---\n";
                            if (hw.cpu && hw.cpu[0]) txt += "CPU: " + hw.cpu[0].name + "\n";
                            if (hw.netinfo && hw.netinfo.totalmem) txt += "RAM: " + formatBytes(hw.netinfo.totalmem) + "\n";
                            if (hw.storage) hw.storage.forEach(function(d, i) { txt += "DRIVE_" + i + ": " + formatDrive(d) + "\n"; });
                            txt += "\n--- RAW HARDWARE JSON ---\n" + JSON.stringify(hw, null, 2) + "\n";
                        } else txt += "\n--- HARDWARE ---\nNema hardverskih podataka.\n";

                        txt += "\n--- SOFTWARE ---\n";
                        if (sw) {
                            var swList = sw.apps || sw; 
                            if (Array.isArray(swList)) swList.forEach(function(s) { txt += `${s.name || s.N} (v${s.version || s.V || 'N/A'})\n`; });
                            else txt += JSON.stringify(sw, null, 2) + "\n";
                        } else txt += "Nema softverskih podataka.\n";
                        txt += "\n=== END OF EXPORT ===\n";
                        
                        downloadBlob(txt, safeName + '_ticket.txt', 'text/plain;charset=utf-8');
                        btnObj.innerHTML = originalText;
                        btnObj.disabled = false;
                    }
                    // 3. SLANJE U MTICKET
                    else if (actionType === 'mticket') {
                        var ws = null;
                        if (typeof meshserver != 'undefined' && meshserver != null) ws = meshserver;
                        else if (typeof server != 'undefined' && server != null) ws = server;
                        else if (typeof window.meshserver != 'undefined' && window.meshserver != null) ws = window.meshserver;
                        else if (typeof app != 'undefined' && app != null && app.server != null) ws = app.server;

                        if (ws != null) {
                            ws.send({ action: 'plugin', plugin: 'exportclient', pluginaction: 'send_api_sync', nodeId: nodeId, hwData: hw, swData: sw });
                            setTimeout(function() {
                                btnObj.innerHTML = originalText;
                                btnObj.disabled = false;
                                var msg = (sw && sw.apps) ? ('\nZapakirano ' + sw.apps.length + ' aplikacija.') : '';
                                alert('✅ Uspješno poslano u mTicket!' + msg);
                            }, 1000);
                        } else {
                            btnObj.innerHTML = originalText;
                            btnObj.disabled = false;
                            alert('❌ Greška: Nema aktivne WebSocket veze.');
                        }
                    }
                }, 150);
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

            // Software Tab
            var swSearch = document.querySelector('input[placeholder*="Search software"]');
            if (swSearch && swSearch.offsetParent !== null) {
                var swToolbar = swSearch.parentNode;
                if (!document.getElementById('mticket-btns-software')) {
                    var swGroup = buildButtonContainer('mticket-btns-software', 'software');
                    swGroup.style.marginLeft = '10px';
                    swToolbar.appendChild(swGroup);
                }
            }

            // Details Tab
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

    // BACK-END ENGINE
    obj.serveraction = function (command, myparent, user) {
        if (command.action !== 'plugin' || command.plugin !== 'exportclient' || command.pluginaction !== 'send_api_sync') return;
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
                var hwFromDb = null;
                if (sysnodes) {
                    var hDoc = Array.isArray(sysnodes) ? sysnodes[0] : sysnodes;
                    if (hDoc) hwFromDb = hDoc.public || hDoc.data || hDoc.hwinfo || hDoc;
                }
                
                safeDbGet(swid, function (err, swnodes) {
                    var swFromDb = null;
                    if (swnodes) {
                        var sDoc = Array.isArray(swnodes) ? swnodes[0] : swnodes;
                        if (sDoc) swFromDb = sDoc.public || sDoc.data || sDoc.apps || sDoc.software || sDoc;
                    }

                    var finalHw = command.hwData || hwFromDb || node.hwinfo || node.hardware || node.sysinfo || null;
                    var finalSw = command.swData || swFromDb || node.software || node.swinfo || node.apps || null;

                    var payloadObj = {
                        node_id: node._id,
                        name: node.name || 'Nepoznato',
                        os: node.osdesc || node.mtype || 'Nepoznato',
                        ip: node.host || 'Offline',
                        hardware: finalHw,
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
    };

    return obj;
};