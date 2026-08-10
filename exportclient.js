'use strict';
/**********************************************************************
 * Copyright (C) 2026 Mr. Green & MCS
 * exportclient.js - Full Export + mTicket API Auto-Sync (Front-End Edition)
 **********************************************************************/

module.exports.exportclient = function (parent) {
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
        if (typeof currentNode == 'undefined' || currentNode == null) return;
        var nodeId = currentNode._id;
        var p19 = document.getElementById('p19');
        if (!p19) return;

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

        var sendToApi = function(e) {
            e.preventDefault();
            var btn = this;
            
            var hwData = null;
            var swData = null;

            // 1. Pokušaj čitanja iz direktnog node objekta
            if (currentNode) {
                hwData = currentNode.hwinfo || currentNode.hardware || currentNode.sysinfo;
                swData = currentNode.software || currentNode.swinfo || currentNode.apps;
            }

            // 2. AUTO-DISCOVERY RAM SKENIRANJE
            if (!hwData || !swData) {
                for (var key in window) {
                    try {
                        if (window[key] && typeof window[key] === 'object' && window[key][nodeId]) {
                            var val = window[key][nodeId];
                            if (!swData && (key.toLowerCase().indexOf('soft') > -1 || (Array.isArray(val) && val.length > 5))) swData = val;
                            if (!hwData && (key.toLowerCase().indexOf('sys') > -1 || key.toLowerCase().indexOf('hw') > -1 || val.netinfo || val.cpu)) hwData = val;
                        }
                    } catch(err) {}
                }
            }

            var payloadStr = "";
            try {
                // Pakiramo podatke (ili prazne objekte ako preglednik zablokira pristup)
                payloadStr = JSON.stringify({ 
                    nodeId: nodeId, 
                    hw: hwData || { "INFO": "Nije pronađeno u UI" }, 
                    sw: swData || { "INFO": "Nije pronađeno u UI" } 
                });
            } catch(e) {
                alert("❌ Greška pri pakiranju podataka (Cirkularna referenca): " + e.message);
                return;
            }

            var originalText = btn.innerHTML;
            btn.innerHTML = '⏳ Slanje...';
            btn.disabled = true;

            // 3. SIGURNI FETCH (s uključivanjem session cookija i detekcijom svih Nginx grešaka)
            fetch('/pluginadmin.ashx?pin=exportclient&action=send_api_post', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin', // OVO JE BILO KLJUČNO ZA RJEŠAVANJE 401 GREŠAKA
                body: payloadStr
            })
            .then(function(res) {
                // Umjesto slijepog vjerovanja da je sve JSON, prvo čitamo raw text
                return res.text().then(function(text) {
                    try {
                        return JSON.parse(text); // Pokušaj parsirati JSON
                    } catch (e) {
                        // Ako Nginx vrati HTML stranicu s greškom (npr. 413, 502, 500)
                        throw new Error("HTTP Kod: " + res.status + "\nOdgovor: " + text.substring(0, 150));
                    }
                });
            })
            .then(function(data) {
                btn.innerHTML = originalText;
                btn.disabled = false;
                if (data.success) alert('✅ Podaci o računalu su uspješno sinkronizirani u mTicket bazu!');
                else alert('❌ Greška poslužitelja: ' + data.error);
            })
            .catch(function(err) {
                btn.innerHTML = originalText;
                btn.disabled = false;
                alert('❌ DETALJNA GREŠKA:\n' + err.message);
            });
        };

        if (document.getElementById('nav-exportclient')) {
            document.getElementById('btn-export-csv').onclick = function(e) { e.preventDefault(); triggerSilentDownload('/pluginadmin.ashx?pin=exportclient&download=csv&node=' + encodeURIComponent(nodeId)); };
            document.getElementById('btn-export-ticket').onclick = function(e) { e.preventDefault(); triggerSilentDownload('/pluginadmin.ashx?pin=exportclient&download=ticket&node=' + encodeURIComponent(nodeId)); };
            document.getElementById('btn-api-sync').onclick = sendToApi;
            return;
        }

        var pluginNav = null;
        var links = p19.getElementsByTagName('a');
        for (var i = 0; i < links.length; i++) {
            if (links[i].innerHTML.indexOf('ScriptTask') !== -1 || links[i].innerHTML.indexOf('Work From Home') !== -1 || links[i].innerHTML.indexOf('Event Log') !== -1) {
                pluginNav = links[i].parentNode;
                break;
            }
        }

        if (!pluginNav) {
            pluginNav = document.createElement('div');
            pluginNav.id = 'pluginNav';
            pluginNav.style.paddingBottom = '15px';
            pluginNav.style.fontSize = '14px';
            var p19title = document.getElementById('p19title');
            if (p19title && p19title.nextSibling) p19.insertBefore(pluginNav, p19title.nextSibling);
            else p19.insertBefore(pluginNav, p19.firstChild);
        }

        if (pluginNav.children.length > 0) {
            var sep = document.createElement('span');
            sep.innerHTML = ' <span style="color:#888;">|</span> ';
            pluginNav.appendChild(sep);
        }

        var myLink = document.createElement('a');
        myLink.id = 'nav-exportclient';
        myLink.href = '#';
        myLink.innerHTML = 'Client Export';
        myLink.style.cursor = 'pointer';
        pluginNav.appendChild(myLink);

        var myPanel = document.createElement('div');
        myPanel.id = 'panel-exportclient';
        myPanel.style.display = 'none';
        
        myPanel.innerHTML = `
            <div style="border:1px solid #ddd; padding:20px; border-radius:5px; background-color:#f9f9f9; margin-top:15px;">
                <h4 style="margin-top:0; color:#333; font-weight:bold;">mTicket Client Export & API Sync</h4>
                <p style="font-size:13px; color:#666; margin-bottom:15px;">Preuzmite podatke ručno ili ih automatski sinkronizirajte s ITAM bazom mTicket sustava.</p>
                <button id="btn-export-csv" class="btn btn-secondary btn-sm" style="margin-right:5px;">📥 Preuzmi CSV</button>
                <button id="btn-export-ticket" class="btn btn-primary btn-sm" style="margin-right:5px;">🎫 Preuzmi TXT</button>
                <button id="btn-api-sync" class="btn btn-success btn-sm">🚀 Pošalji u mTicket</button>
            </div>
        `;
        p19.appendChild(myPanel);

        myLink.onclick = function(e) {
            e.preventDefault();
            for (var i = 0; i < p19.children.length; i++) {
                var child = p19.children[i];
                if (child.id === 'p19title' || child === pluginNav || child === myPanel) continue;
                child.style.display = 'none';
            }
            myPanel.style.display = 'block';
        };

        document.getElementById('btn-export-csv').onclick = function(e) { e.preventDefault(); triggerSilentDownload('/pluginadmin.ashx?pin=exportclient&download=csv&node=' + encodeURIComponent(nodeId)); };
        document.getElementById('btn-export-ticket').onclick = function(e) { e.preventDefault(); triggerSilentDownload('/pluginadmin.ashx?pin=exportclient&download=ticket&node=' + encodeURIComponent(nodeId)); };
        document.getElementById('btn-api-sync').onclick = sendToApi;
    };

    // ====================================================================
    // BACK-END: HTTP API (POST & GET)
    // ====================================================================
    obj.handleAdminReq = function(req, res, user) {
        
        // 1. API SYNC (NOVI POST PRISTUP)
        if (req.query.action === 'send_api_post') {
            res.setHeader('Content-Type', 'application/json');
            
            var processSync = function(parsedBody) {
                var nId = parsedBody.nodeId;
                var frontEndHw = parsedBody.hw;
                var frontEndSw = parsedBody.sw;

                var safeDbGet = function(id, callback) {
                    if (typeof obj.meshServer.db.Get === 'function') obj.meshServer.db.Get(id, callback);
                    else if (typeof obj.meshServer.db.get === 'function') obj.meshServer.db.get(id, callback);
                    else callback("Nema DB funkcije", null);
                };

                safeDbGet(nId, function (err, nodes) {
                    var node = null;
                    if (Array.isArray(nodes) && nodes.length > 0) node = nodes[0];
                    else if (nodes && !Array.isArray(nodes) && nodes._id) node = nodes;

                    if (!node) return res.send(JSON.stringify({ success: false, error: 'Računalo nije pronađeno u bazi.' }));

                    var payloadObj = {
                        node_id: node._id,
                        name: node.name || 'Nepoznato',
                        os: node.osdesc || node.mtype || 'Nepoznato',
                        ip: node.host || 'Offline',
                        hardware: frontEndHw || null,
                        software: frontEndSw || null
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

                    var apiReq = https.request(options, function(apiRes) {
                        var body = '';
                        apiRes.on('data', function(chunk) { body += chunk; });
                        apiRes.on('end', function() {
                            if (apiRes.statusCode >= 200 && apiRes.statusCode < 300) res.send(JSON.stringify({ success: true }));
                            else res.send(JSON.stringify({ success: false, error: 'HTTP ' + apiRes.statusCode }));
                        });
                    });

                    apiReq.on('timeout', function() { apiReq.destroy(); res.send(JSON.stringify({ success: false, error: 'Timeout mTicket servera.' })); });
                    apiReq.on('error', function(e) { res.send(JSON.stringify({ success: false, error: e.message })); });

                    apiReq.write(payloadStr);
                    apiReq.end();
                });
            };

            // BACKEND OSIGURAČ: Ako je body prazan, nećemo zapeti u beskonačno učitavanje
            if (req.body && Object.keys(req.body).length > 0) {
                processSync(req.body);
            } else if (typeof req.body === 'string' && req.body.length > 0) {
                try { processSync(JSON.parse(req.body)); }
                catch (e) { res.send(JSON.stringify({ success: false, error: 'Greška u parse stringa' })); }
            } else {
                var bodyData = '';
                var hasData = false;
                
                req.on('data', function(chunk) { hasData = true; bodyData += chunk; });
                req.on('end', function() {
                    if (hasData) {
                        try { processSync(JSON.parse(bodyData)); } 
                        catch (e) { res.send(JSON.stringify({ success: false, error: 'Greška pri parsiranju RAW JSON podataka.' })); }
                    }
                });

                // Timeout ako stream visi
                setTimeout(function() {
                    if (!hasData && !res.headersSent) {
                        res.send(JSON.stringify({ success: false, error: 'Prazan zahtjev.' }));
                    }
                }, 2000);
            }
            return;
        }

        // --------------------------------------------------------
        // 2. CSV i TXT GENERIRANJE (Stari pristup iz baze)
        // --------------------------------------------------------
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