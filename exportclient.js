'use strict';
/**********************************************************************
 * Copyright (C) 2026 Mr. Green & MCS
 * 
 * exportclient.js - Backend Full Hardware/Software Export
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
    // BACK-END: FORMATIRANJE I IZVOZ PODATAKA
    // ====================================================================
    obj.handleAdminReq = function(req, res, user) {
        
        if (req.query.download === 'csv' || req.query.download === 'ticket') {
            
            var nodeid = req.query.node;
            if (!nodeid) return res.status(400).send('Nedostaje Node ID u URL-u.');

            var sysid = nodeid.replace(/^node\/\//, 'si//');
            var swid  = nodeid.replace(/^node\/\//, 'sw//');

            // Vadimo glavni node, sysinfo i software
            obj.meshServer.db.Get([nodeid, sysid, swid], function (err, docs) {
                var node = null, sysinfo = null, software = null;
                
                if (docs && docs.length > 0) {
                    for (var i = 0; i < docs.length; i++) {
                        if (docs[i]._id === nodeid) node = docs[i];
                        else if (docs[i]._id === sysid) sysinfo = docs[i];
                        else if (docs[i]._id === swid) software = docs[i];
                    }
                }

                if (!node) return res.status(404).send('Računalo nije pronađeno u bazi.');
                var safeName = (node.name || 'racunalo').replace(/[^a-z0-9]/gi, '_').toLowerCase();

                // --------------------------------------------------------
                // POMOĆNE FUNKCIJE ZA FORMATIRANJE HARDVERA
                // --------------------------------------------------------
                
                // Povlačenje sysinfo iz bilo kojeg mogućeg JSON mjesta
                var hw = sysinfo ? (sysinfo.data || sysinfo.hwinfo || sysinfo) : (node.hwinfo || null);
                var sw = software ? (software.data || software.apps || software.software || software) : (node.software || null);
                
                // Formatiranje bajtova u GB
                function formatBytes(bytes) {
                    if (!bytes || bytes === 0) return 'Nepoznato';
                    var gb = (bytes / (1024 * 1024 * 1024)).toFixed(2);
                    return gb + ' GB';
                }

                // Formatiranje diska (Oduzimanje praznog prostora)
                function formatDrive(drive) {
                    if (!drive) return 'Nepoznat Disk';
                    var total = (drive.total / (1024*1024*1024)).toFixed(2);
                    var free = (drive.free / (1024*1024*1024)).toFixed(2);
                    return drive.name + " (" + total + " GB Ukupno, " + free + " GB Slobodno)";
                }

                // --------------------------------------------------------
                // CSV GENERIRANJE (Savršeno formatirano za Excel)
                // --------------------------------------------------------
                if (req.query.download === 'csv') {
                    var csv = "Kategorija,Svojstvo,Vrijednost\n";
                    csv += `OSNOVNO,Ime,${node.name || 'Nepoznato'}\n`;
                    csv += `OSNOVNO,IP Adresa,${node.host || 'Offline'}\n`;
                    csv += `OSNOVNO,Operativni Sustav,${node.osdesc || node.mtype || 'Nepoznato'}\n`;
                    
                    if (hw) {
                        // BIOS / Matična ploča
                        if (hw.bios && hw.bios.length > 0) csv += `HARDVER,Matična ploča,${hw.bios[0].board_name || 'Nepoznato'} (${hw.bios[0].board_vendor || ''})\n`;
                        
                        // RAM
                        if (hw.netinfo) { // Ponekad RAM zna biti skriven u root node-u
                            csv += `HARDVER,RAM Memorija,${formatBytes(hw.netinfo.totalmem || hw.totalmem)}\n`;
                        }
                        
                        // Procesori
                        if (hw.cpu && hw.cpu.length > 0) {
                            hw.cpu.forEach(function(cpu) {
                                var cpuName = cpu.name ? cpu.name.replace(/,/g, ' ') : 'Nepoznati CPU';
                                csv += `HARDVER,Procesor,${cpuName}\n`;
                            });
                        }

                        // Diskovi
                        if (hw.storage && hw.storage.length > 0) {
                            hw.storage.forEach(function(hdd) {
                                var diskName = formatDrive(hdd).replace(/,/g, ' ');
                                csv += `HARDVER,Disk,${diskName}\n`;
                            });
                        }
                        
                        // Mreža (MAC i IP adrese svih kartica)
                        if (hw.netinfo && hw.netinfo.netifs && hw.netinfo.netifs.length > 0) {
                            hw.netinfo.netifs.forEach(function(net) {
                                if (net.mac && net.mac !== '00:00:00:00:00:00') {
                                    csv += `MREŽA,${net.name.replace(/,/g, ' ')},MAC: ${net.mac} | IPv4: ${net.ipv4 || 'Nema'}\n`;
                                }
                            });
                        }
                    } else {
                        csv += "HARDVER,Upozorenje,Agent još nije poslao podatke o hardveru.\n";
                    }

                    // Softver
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
                // --------------------------------------------------------
                // TXT GENERIRANJE (Za direktan Import u Ticketing sustav)
                // --------------------------------------------------------
                else if (req.query.download === 'ticket') {
                    var txt = "=== MESH CENTRAL TICKET EXPORT ===\n";
                    txt += "MC_NODE_ID: " + node._id + "\n";
                    txt += "HOSTNAME: " + (node.name || 'N/A') + "\n";
                    txt += "OS_TYPE: " + (node.osdesc || node.mtype || 'N/A') + "\n";
                    txt += "LAST_IP: " + (node.host || 'Offline') + "\n";
                    
                    if (hw) {
                        txt += "\n--- HARDWARE SUMMARY ---\n";
                        
                        // CPU
                        if (hw.cpu && hw.cpu[0]) txt += "CPU: " + hw.cpu[0].name + "\n";
                        
                        // RAM
                        if (hw.netinfo) txt += "RAM: " + formatBytes(hw.netinfo.totalmem || hw.totalmem) + "\n";
                        
                        // Diskovi
                        if (hw.storage) {
                            for(var d=0; d<hw.storage.length; d++) {
                                txt += "DRIVE_" + d + ": " + formatDrive(hw.storage[d]) + "\n";
                            }
                        }

                        // Sirovi JSON za mTicket PHP obradu
                        txt += "\n--- RAW HARDWARE JSON ---\n";
                        txt += JSON.stringify(hw, null, 2) + "\n";
                    } else {
                        txt += "\n--- HARDWARE ---\nNema hardverskih podataka u bazi.\n";
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
                        txt += "Nema softverskih podataka u bazi.\n";
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