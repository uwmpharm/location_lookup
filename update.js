
const TABLES = {
    table1: {
        tableName: 'test_dms_extsys_item_valid',
        idColumn: 'id',
        columns: 'item, item_description, external_item_description, external_item, external_system_name ',
        column_mapping: {
            //'Verified': 'verified',
            //'Verified - Description': 'verified_description',
            'External System Name': 'external_system_name',
            //'Item Search Option' : 'item_search_option',
            //'Item Search Option - Description' : 'item_search_option_description',
            'External Item' : 'external_item',
            'External Item Description' : 'external_item_description',
            //'External Item UOM' : 'external_item_uom',
            //'Active' : 'active',
            //'Active - Description' : 'active_description',
            'Item' : 'item',
            'Item Description' : 'item_description',
            //'Item UOMs' : 'item_uoms',
        }
    },
    table2: {
        tableName: 'test_wms_iv_f',
        idColumn: 'id',
        columns: 'item, item_description, uom, uom_1, pharmacy, type, type_description',
        column_mapping: {   
            'Pharmacy' : 'pharmacy',
            'Item' : 'item',
            //'ABC by Inventory Value' : 'abc_by_inventory_value',
            'Item Description' : 'item_description',
            //'Area' : 'area',
            //'Description 1' : 'description_1',
            //'Brand Name' : 'brand_name',
            //'Package Code' : 'package_code',
            //'Handling' : 'handling',
            //'Actual Location' : 'actual_location',
            'Type' : 'type',
            'Type - Description' : 'type_description',
            //'Current Quantity' : 'current_quantity',
            'UOM 1' : 'uom_1',
            //'In-Transit Quantity' : 'in_transit_quantity',
            //'Allocated Quantity' : 'allocated_quantity',
            //'Quantity' : 'quantity',
            'UOM' : 'uom',
            //'Item Lend Status' : 'item_lend_status',
            //'Hold Code' : 'hold_code',
            //'Inventory Status' : 'inventory_status',
            //'Inventory Status - Description' : 'inventory_status_description',
            //'Container' : 'container',
            //'Item Expiration Date' : 'item_expiration_date',
            //'Tag' : 'tag',
            //'Section' : 'section',
            //'Created On' : 'created_on',
            //'Created By' : 'created_by',
            //'Expired' : 'expired',
            //'Expired - Description' : 'expired_description',
        }
    },
    table3: {
        tableName: 'test_wms_lc_f',
        idColumn: 'id',
        columns: 'forward_pick_item, location, type_description, type, pharmacy',
        column_mapping: {
            'Pharmacy' : 'pharmacy',
            'Location' : 'location',
            'Type' : 'type',
            'Type - Description' : 'type_description',
            //'Temp. Control' : 'temp_control',
            //'Temp. Control - Description' : 'temp_control_description',
            'Forward Pick Item' : 'forward_pick_item',
            //'Forward Pick Lot' : 'forward_pick_lot',
            //'Forward Pick Package Code' : 'forward_pick_package_code',
            //'Description 1' : 'description_1',
            //'Location Status' : 'location_status',
            //'Width' : 'width',
            //'Empty' : 'empty',
            //'Empty - Description' : 'empty_description',
            //'Inventory' : 'inventory',
            //'Forward Pick Search Path' : 'forward_pick_search_path', 
            //'Maximum FP Location Capacity' : 'maximum_fp_location_capacity',
            //'Batch Replenishment Quantity' : 'batch_replenishment_quantity',
            //'Dynamic Replenishment Quantity' : 'dynamic_replenishment_quantity',
        //     'Replenishment UOM' : 'replenishment_uom',
        //     'Batch Replenishment FP Trigger Quantity' : 'batch_replenishment_fp_trigger_quantity',//batch_trigger_quantity
        //     'Dynamic Replenishment FP Trigger Quantity' : 'dynamic_replenishment_fp_trigger_quantity',//dynamic_trigger_quantity
        //     'FP Picking UOM' : 'fp_picking_uom',
        //     'Section' : 'section',
        //     'Area' : 'area',
        //     'Zone' : 'zone',
        //     'Route Point' : 'route_point',
        //     'Location Class' : 'location_class',
        //     'Cycle Count Status' : 'cycle_count_status',
        //     'Cycle Count Status - Description' : 'cycle_count_status_description',
        //     'Tag Tracking' : 'tag_tracking',
        //     'Tag Tracking - Description' : 'tag_tracking_description',
        //     'Record ID' : 'record_id',
        //     'Modified By' : 'modified_by'
         }
    }
};



const batch_size = 200;
const uploadSb = window.adminSb;


const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const fileNameDisplay = document.getElementById('fileName');
const uploadButton = document.getElementById('uploadButton');
const statusDisplay = document.getElementById('statusDisplay');
const progressBar = document.getElementById('progressBar');
const progressBarFill = document.getElementById('progressBarFill');
const progressContainer = document.getElementById('progressContainer');
const removeButton = document.getElementById('removeButton');
const errorDisplay = document.getElementById('errorDisplay');

    let parsedData = [];

    function normalizeHeader(header) {
        return String(header || '')
            .replace(/\u00a0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    function getHeaderMatches(headers, columnMapping) {
        const fileHeadersByNormalized = new Map();
        headers.forEach(header => {
            const normalized = normalizeHeader(header);
            if (normalized && !fileHeadersByNormalized.has(normalized)) {
                fileHeadersByNormalized.set(normalized, header);
            }
        });

        const matches = [];
        const unmatchedExpected = [];
        for (const [expectedHeader, dbColumn] of Object.entries(columnMapping)) {
            const actualHeader = fileHeadersByNormalized.get(normalizeHeader(expectedHeader));
            if (actualHeader) {
                matches.push({ expectedHeader, actualHeader, dbColumn });
            } else {
                unmatchedExpected.push(expectedHeader);
            }
        }

        return { matches, unmatchedExpected };
    }

    dropzone.addEventListener('click', () => {
        fileInput.click();
    });

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        handleFile(file);
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        handleFile(file);
    });

    removeButton.addEventListener('click', () => {
        parsedData = [];
        fileNameDisplay.textContent = 'No file selected';
        statusDisplay.textContent = '';
        progressContainer.style.display = 'none';
        errorDisplay.textContent = '';
        uploadButton.disabled = true;
    });

    async function triggerCache() {
        try{
            await fetch('http://localhost:3001/update-cache', { method: 'POST' });
            console.log('Cache update triggered');
        } catch (error) {
            console.error('Failed to trigger cache update:', error);
        }
    }

    function parseExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd', defval: '' });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(sheet);
                    resolve(jsonData);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = function() {
                reject(new Error('Error reading ' + file.name));
            };
            reader.readAsArrayBuffer(file);
        });
    }

    async function handleFile(file) {
        const selectedValue = document.getElementById('tableSelect').value;
        if(!selectedValue){
            alert('Please select a table to update before uploading a file.');
            return;
        }
        const { tableName, column_mapping } = TABLES[selectedValue] || {};
        if (!file) return;
        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
            alert('Please select a valid Excel file (.xlsx or .xls)');
            return;
        }
        fileNameDisplay.textContent = file.name;
        showStatus('Parsing file...');
        try {
            const raw = await parseExcelFile(file);
            console.log('Excel headers:', Object.keys(raw[0]));
            if(!raw.length){
                return showStatus('No data found in the file');
            }
            const headers = Object.keys(raw[0]);
            const {tableName, column_mapping} = TABLES[selectedValue] || {};
            const { matches, unmatchedExpected } = getHeaderMatches(headers, column_mapping);
            if (!matches.length) {
                alert('No matching columns found in the file. Please check the column names.');
                return;
            }
            console.log('Matched columns:', matches);
            if (unmatchedExpected.length) {
                console.warn('Expected columns not found in Excel file:', unmatchedExpected);
                errorDisplay.textContent = `Warning: ${unmatchedExpected.length} expected columns were not found. Check the console for the list.`;
            } else {
                errorDisplay.textContent = '';
            }
            const expectedDbColumns = Array.from(new Set(Object.values(column_mapping)));
            parsedData = raw.map(row => {
                const mappedRow = {};
                for (const dbColumn of expectedDbColumns) {
                    mappedRow[dbColumn] = null;
                }
                for (const { actualHeader, dbColumn } of matches) {
                    if(actualHeader in row){
                        let value = row[actualHeader];
                        if (value instanceof Date) {
                            value = value.toISOString().split('T')[0];
                        }
                        mappedRow[dbColumn] = value ?? null;
                    }
                }
                return mappedRow;
            }).filter(row => Object.keys(row).length > 0);
            console.log('First parsed row:', parsedData[0]);
            console.log('Sample row being sent:', parsedData[0]);
            uploadButton.disabled = false;
            removeButton.disabled = false;
            showStatus(`Parsed ${parsedData.length} rows with ${matches.length} matched columns. Ready to upload.`);
        } catch (error) {
            console.error('Error parsing file:', error);
            alert('Error parsing file: ' + error.message);
            showStatus('Error parsing file');
        }
    }

        uploadButton.addEventListener('click', async () => {
            const selectedValue = document.getElementById('tableSelect').value;
            const { tableName, idColumn, columns } = TABLES[selectedValue] || {};
            
            console.log('Uploading to table:', tableName);
            if(!uploadSb){
                errorDisplay.textContent = 'Upload failed: Supabase admin client is not loaded.';
                showStatus('Upload failed: Supabase admin client is not loaded.');
                return;
            }
            if(!parsedData.length){
                alert('No data to upload!');
                return;
            }
            uploadButton.disabled = true;
            removeButton.disabled = true;
            errorDisplay.textContent = '';
            statusDisplay.textContent = 'Uploading...';
            progressContainer.style.display = 'block';
            try {
                const { error: deleteError } = await uploadSb.from(tableName).delete().not(idColumn, 'is', null);
                console.log('Delete result:', deleteError);
                if(deleteError) throw new Error(`Delete failed: ${deleteError.message}`);
                
                const chunks = chunk(parsedData, batch_size);
                let insertedCount = 0;
                for(let i = 0; i < chunks.length; i++){
                    setProgress(Math.round(((i + 1) / chunks.length) * 100), `Uploading batch ${i + 1} of ${chunks.length}`);
                    showStatus(`Uploading batch ${i + 1} of ${chunks.length}...`);
                    console.log('Keys being inserted:', Object.keys(chunks[i][0]));
                    console.log('First row in batch:', JSON.stringify(chunks[i][0]));
                    const { error: insertError } = await uploadSb
                        .from(tableName)
                        .insert(chunks[i]);
                    console.log('Insert result:', insertError);
                    if(insertError) throw new Error(`Insert failed: ${insertError.message}`);
                    insertedCount += chunks[i].length;
                }
                await triggerCache();
                console.log('Triggering cache update...');

                const { count, error: countError } = await uploadSb
                    .from(tableName)
                    .select(columns || '*', { count: 'exact', head: true });
                console.log('Final row count:', { count, countError });
                if(countError) {
                    console.warn('Upload finished, but row count check failed:', countError);
                }

                setProgress(100, 'Finalizing...');
                showStatus('Finalizing upload...');

                // finished uploading
                setProgress(100, 'Done');
                if(count === insertedCount) {
                    showStatus(`Upload complete: inserted ${insertedCount} rows. Supabase count confirms ${count} rows in ${tableName}.`);
                } else if(count === 0 && insertedCount > 0) {
                    showStatus(`Upload complete: inserted ${insertedCount} rows. Count check returned 0, likely because SELECT/count is blocked by RLS.`);
                } else if(typeof count === 'number') {
                    showStatus(`Upload complete: inserted ${insertedCount} rows. Count check returned ${count} visible rows in ${tableName}.`);
                } else {
                    showStatus(`Upload complete: inserted ${insertedCount} rows. Count check was not available.`);
                }
            } catch (error) {
                errorDisplay.textContent = 'Upload failed: ' + error.message;
                showStatus('Upload failed: ' + error.message);
                setProgress(0);
                progressContainer.style.display = 'none';
            } finally {
                uploadButton.disabled = false;
                removeButton.disabled = false;
            }
        });

            function chunk(array, size) {
                const result = [];
                for (let i = 0; i < array.length; i += size) {
                    result.push(array.slice(i, i + size));
                }
                return result;
            }

            function setProgress(percent) {
                progressBarFill.style.width = percent + '%';
            }

            function showStatus(text) {
                statusDisplay.textContent = text;
            }     

    

