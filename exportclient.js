'use strict';
/**********************************************************************
 * Copyright (C) 2026 Mr. Green & MCS
 * 
 * exportclient.js - Backend Full Export + RAM Fallback
 **********************************************************************/

module.exports.exportclient = function (parent) {
    var obj = {};
    obj.parent = parent;
    obj.meshServer = parent.parent;

    obj.exports = [
        'onDeviceRefreshEnd'
    ];

    // ====================================================================
    // FRONT-END: WEB UI HOOK (Bez Logout Flickera)
    // ====================================================================
    obj.onDeviceRefreshEnd = function () {
        if (typeof currentNode == 'undefined' || currentNode == null) return;
        var nodeId = currentNode._id;

        var p19 = document.getElementById('p19');
        if (!p19) return;

        // Skriveni iframe sprečava treperenje/logout prilikom downloada
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

        if (document.getElementById('nav-exportclient')) {
            document.getElementById('btn-export-csv').onclick = function(e) { e.preventDefault(); triggerSilentDownload('/pluginadmin.ashx?pin=exportclient&download=csv&node=' + encodeURIComponent(nodeId)); };
            document.getElementById('btn-export-ticket').onclick = function(e) { e.preventDefault(); triggerSilentDownload('/pluginadmin.ashx?pin=exportclient&download=ticket&node=' + encodeURIComponent(nodeId)); };
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
            if (p19title && p19title.nextSibling) {
                p19.insertBefore(pluginNav, p19title.nextSibling);
            } else {
                p19.insertBefore(pluginNav, p19.firstChild);
            }
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
        
        myPanel.innerHTML = '<div style="border:1px solid #ddd; padding:20px; border-radius:5px; background-color:#f9f9f9; margin-top:15px;">' +
                            '<h4 style="margin-top:0; color:#333; font-weight:bold;">mTicket Client Export</h4>' +
                            '<p style="font-size:13px; color:#666; margin-bottom:15px;">Preuzmite POTPUNU hardversku specifikaciju i popis softvera.</p>' +
                            '<button id="btn-export-csv" class="btn btn-secondary btn-sm" style="margin-right:10px;">Preuzmi CSV</button>' +
                            '<button id="btn-export-ticket" class="btn btn-primary btn-sm">Preuzmi TXT (Ticketing)</button>' +
                            '</div>';
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
    };

    // ====================================================================
    // BACK-END: HTTP ZAHTJEVI (Ispravno čitanje Baze + RAM Fallback)
    // ====================================================================
    obj.handleAdminReq = function(req, res, user) {
        
        if (req.query.download === 'csv' || req.query.download === 'ticket') {
            
            var nodeid = req.query.node;
            if (!nodeid) return res.status(400).send('Nedostaje Node ID u URL-u.');

            // OVDJE JE ISPRAVAK: Tražimo samo nodeid (bez nizova!)
            obj.meshServer.db.Get(nodeid, function (err, nodes) {
                
                if (err || !nodes || nodes.length === 0) {
                    return res.send("<h3>Računalo nije pronađeno u bazi!</h3><p>Greška: " + String(err) + "</p>");
                }
                
                var node = nodes[0];
                var safeName = (node.name || 'racunalo').replace(/[^a-z0-9]/gi, '_').toLowerCase();

                // Vadimo hardver/softver iz Node dokumenta
                var hw = node.hwinfo || node.coreinfo || null;
                var sw = node.software || node.apps || null;

                // MAGIJA: Ako podaci fale u bazi, čupamo ih iz RAM-a direktno od aktivnog agenta!
                if (!hw || !sw) {
                    var wsagents = obj.meshServer.webserver.wsagents;
                    if (wsagents && wsagents[nodeid]) {
                        if (!hw && wsagents[nodeid].hwinfo) hw = wsagents[nodeid].hwinfo;
                        if (!sw && wsagents[nodeid].software) sw = wsagents[nodeid].software;
                    }
                }

                // Formatiranje bajtova u GB
                function formatBytes(bytes) {
                    if (!bytes || bytes === 0) return 'Nepoznato';
                    var gb = (bytes / (1024 * 1024 * 1024)).toFixed(2);
                    return gb + ' GB';
                }

                // Formatiranje diska
                function formatDrive(drive) {
                    if (!drive) return 'Nepoznat Disk';
                    var total = (drive.total / (1024*1024*1024)).toFixed(2);
                    var free = (drive.free / (1024*1024*1024)).toFixed(2);
                    return drive.name + " (" + total + " GB Ukupno, " + free + " GB Slobodno)";
                }

                // --- CSV GENERIRANJE ---
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
                // --- TXT GENERIRANJE ---
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
        } else {
            res.sendStatus(404);
        }
    };

    return obj;
};