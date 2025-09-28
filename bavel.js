import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
dotenv.config();

const browser =  await puppeteer.launch({
    headless: false
})
const page = await browser.newPage();

async function bavel(date){
    date = date.split('-')
    await page.goto("https://bavel.voxelgroup.net")
    const etname =  "input#Username"
    await page.waitForSelector(etname)
    await page.type(etname, process.env.BAVELUSER)
    await page.type("input#password", process.env.BAVELPASSWORD);
    await page.click("button.btn.btn-primary.submit-button[name=button]")

    await page.waitForNavigation();
    // Tipo de documento
    await page.waitForSelector("select[name='ctl00$cph1$m_ddlTransactionType']");
    await page.waitForSelector("#ctl00_cph1_RadDatePickerDateFrom_dateInput")
    await page.evaluate((dateArray) => {
        document.querySelector("select[name='ctl00$cph1$m_ddlTransactionType']").selectedIndex = 0;

        const datePicker = $find("ctl00_cph1_RadDatePickerDateFrom");
        const datePicker2 =  $find('ctl00_cph1_RadDatePickerDateTo_dateInput');
        const newDate = new Date(parseInt(dateArray[2]),(parseInt(dateArray[1]) - 1), parseInt(dateArray[0]));
        datePicker.set_selectedDate(newDate);
        datePicker2.set_selectedDate(newDate);
        document.querySelector("#ctl00_cph1_m_btnSearchTransactions").click()
        
    }, date);
    await page.waitForSelector('tbody', { visible: true })
}
async function getAllemisor(params) {
    return await page.evaluate(() => {
        const items = document.querySelectorAll('#SkinnedListBox1 li');

        const emisoresConIndices = Array.from(items, (item, index) => ({
            indice: index,
            emisor: item.textContent.trim()
        }));

        return emisoresConIndices;
    })
}
async function selectEmisor(emisor) {
    await page.click('#ctl00_cph1_ESearcherSender_RadTextEmpresa_GoButton')
    await page.waitForSelector('#ctl00_cph1_ESearcherRecipient_RadTextEmpresa_GoButton', {visible: true})

    const iframeSelector = 'iframe[name="WESearcherSender"]';
    const iframeElement = await page.waitForSelector(iframeSelector);
    const iframe = await iframeElement.contentFrame();

    if (!iframe) {
        throw new Error("No se pudo encontrar o acceder al iframe del buscador.");
    }
    
    // 3. Espera a que la lista de opciones cargue DENTRO del iframe.
    const listItemSelector = '#SkinnedListBox1 li';
    await iframe.waitForSelector(listItemSelector);

    return await page.evaluate(async (emisor)=>{
        function waitForElement(selector, timeout = 10000) {
            return new Promise((resolve, reject) => {
                const intervalId = setInterval(() => {
                    const element = document.querySelector(selector);
                    if (element) {
                        clearInterval(intervalId);
                        resolve(element);
                    }
                }, 100);
                setTimeout(() => {
                    clearInterval(intervalId);
                    reject(new Error(`No se encontró el elemento "${selector}"`));
                }, timeout);
            });
        }
        await waitForElement('input')
        const items = document.querySelectorAll('#SkinnedListBox1 li');
        const indice = Array.from(items).findIndex(item => item.textContent.trim() === emisor);
        document.querySelector('#SkinnedListBox1 li.rfdSelect_selected').classList.remove('rfdSelect_selected');
        document.querySelectorAll('#SkinnedListBox1 li')[indice].classList.add('rfdSelect_selected')
        document.querySelector("#RadTextBoxNombre").value = emisor;
    },emisor)
}
//Obtiene los identificadores para usar la funcion rqDownload de la web
async function getAllinfo() {
    return await page.evaluate(async () =>{
        const grid = await $find("ctl00_cph1_RadGrid1");
        const dataItems = await grid.get_masterTableView().get_dataItems();

        const allData = await dataItems.map(item => {
            const cells = item.get_element().querySelectorAll('td');
            
            const rowData = {
                id: cells[1].textContent.trim(),
                code: cells[2].textContent.trim(),
                fechaEnvio: cells[4].textContent.trim(),
                fechaEfectiva: cells[5].textContent.trim(),
                referencia: cells[6].textContent.trim(),
                ncf: cells[7].textContent.trim(),
                emisor: cells[8].textContent.trim(),
                destinatario: cells[9].textContent.trim(),
                importe: cells[10].textContent.trim(),
                moneda: cells[11].textContent.trim()
            };
            
            return rowData;
        });

        return allData;
    })
}
//Descarga el documento
async function downloadDocument(id, code){
    await page.evaluate(async (id, code)=>{
        await rqDownload(id, code);
    }, id, code)
    await page.waitForSelector("iframe[name='DialogDTidRq']", {visible: true})
    return await page.evaluate(async (id, code)=>{
        let ddown = document.querySelector("#DataListPDFs_ctl00_iFramePDF");
        return ddown.contentWindow.location.href
    }, id, code)
}
