/*
********************************************************************************************
* NAME : GenericChangeOwnerLwc
* DESCRIPTION: This LWC component allows for searching, displaying, and updating the owner of records in Salesforce.
* It provides functionality for both individual and bulk record owner changes. Users can select records,
* search for records based on object types, and assign a new owner to selected records or in bulk.
* @AUTHOR ASJAD AHMED
* MODIFICATION LOG:
* DEVELOPER DATE DESCRIPTION
* ----------------------------------------------------------------------------
* ASJAD AHMED 05.10.2024 Initial creation of the component with basic functionalities.
*/
import { LightningElement, api, track, wire } from 'lwc';
import searchForRecords from '@salesforce/apex/GenericChangeOwnerLwcController.searchForRecords';
import updateOwnerOfRecords from '@salesforce/apex/GenericChangeOwnerLwcController.updateOwnerOfRecords';
import updateOwnerOfRecordsBulk from '@salesforce/apex/GenericChangeOwnerLwcController.updateOwnerOfRecordsBulk';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';



export default class GenericChangeOwnerLwc extends LightningElement {

    @track isLoading = false;
    hasInitialized = false;;
    @track allChecked = false;
    objectApiName = '';
    objectLabel = '';
    showObjectField = false;
    bulkUserId = '';
    listSelectedObjects = [];
    @track showObjectList = [];
    mapColumns  = new Map();
    tableData = []; // [][]
    @track originalTableData = []; // [][]
    @track tableColumns = [];
    showPill = false;
    selectedRecordIds = [];
    showBulkAssignButton = false;
    currentTab = 'select-records';
    showAssignToUserTab = false;

    userId = '';
    assigneeUserId = '';

    @track objectOptions = [
        { label: 'Account', value: 'Account' },
        { label: 'Preventive Maintenance', value: 'WorkOrder' },
        { label: 'Opportunity', value: 'Opportunity' },
        { label: 'Repair Opportunity', value: 'Repair Opportunity' },
        { label: 'ServiceContract', value: 'ServiceContract' },
        { label: 'Installation Order', value: 'Installation_Order__c' },
        { label: 'Field Service Notification', value: 'Case' }
    ];

    @track activeUserFilter = {
        criteria: [
            {
                fieldPath: 'IsActive',
                operator: 'eq',
                value: true
            }
        ]
    }

    UserDisplayInfo = {
        primaryField: 'Name'
        // additionalFields: ['Product__r.Name' ],
    };


    connectedCallback(){
      this.listSelectedObjects = ['Account', 'Asset','WorkOrder','Quote','Opportunity','Repair Opportunity','ServiceContract','Account','Account','Account','Account',];
      let tempObj = {
        name : 'asdasdasdas',
        innerObj : {
            name2 : 'name2'
        }
      }
      console.log('asdasdasdasda'+tempObj['innerObj']);
    }

    handleSearch(){
        this.clearSelections();
        this.isLoading = true;
        searchForRecords({sObjectName : this.objectApiName, ownerId : this.userId})
        .then((result)=>{
            this.allChecked = false;
            let data = JSON.parse(result);
            this.mapColumns = data.mapColumnsAPIToLabel;
            let b1 =  this.parseColumns();
            let b2 =  this.parseDataFromApex(data.listRecords);
            if (b1 && b2) {
                this.hasInitialized = true;
            }
            console.log(this.tableData);
            this.isLoading = false;
        }).catch((error) => {
            this.isLoading = false;
            console.log("Error : "+JSON.stringify(error));
            this.handleError(error);
        });
    }

    handleInTableSearch(event){
        console.log(event.target.value )
        if (event.key === 'Enter' && event.target.value != null && event.target.value != undefined) {
            this.isLoading = true;
            this.allChecked = false;
            // this.selectedRecordIds = [];
            const searchKey = event.target.value ? event.target.value.toLowerCase() : '';
            let tempData = JSON.parse(JSON.stringify(this.originalTableData));
            if (searchKey && searchKey != '') {
                if (tempData) {
                    let matchRecords = [];
                    tempData.forEach((record, index) => {
                        let valuesArray = record.fields;
                        for (let val of valuesArray) {
                            if (val != null) {
                                let strVal = String(val.value);
                                if (strVal) {
                                    if (strVal.toLowerCase().includes(searchKey)) {
                                        matchRecords.push(tempData[index]);
                                        break;
                                    }
                                }
                            }
                        }
                    });
                    
                    matchRecords.forEach((record, index) => {
                        if (this.selectedRecordIds.includes(matchRecords[index].id)) {
                            matchRecords[index].checked = true;
                        }
                    });
                    this.tableData = JSON.parse(JSON.stringify(matchRecords));
                }
            } else {
                console.log(this.selectedRecordIds);
                this.originalTableData.forEach((record, index) => {
                    if (this.selectedRecordIds.includes(this.originalTableData[index].id)) {
                        this.originalTableData[index].checked = true;
                    }
                });
                this.tableData = JSON.parse(JSON.stringify(this.originalTableData));
            }
            console.log('tableData Records are ' + JSON.stringify(this.tableData));
            console.log('originalTableData Records are ' + JSON.stringify(this.originalTableData));
        }
        this.isLoading = false;
    }

    parseColumns(){
        if (this.mapColumns ) {
            //this.tableColumns.push('Id');
            this.tableColumns.push('Owner');
            Object.keys(this.mapColumns).map(fieldName => {
                console.log(fieldName + ' -- '+ this.mapColumns[fieldName]);
                this.tableColumns.push(this.mapColumns[fieldName]);
            });
            return true;
        }else{
            this.toastEvent('error', 'Error!', 'No Field Set found on selected object!');
            return false;
        }
    }

    parseDataFromApex(objectRecords){
        if (objectRecords && objectRecords.length > 0) {
            objectRecords.forEach((record, index) => {
                let recordValueArray = {serialNumber: index+1, id: record.Id, checked : false, fields: []};
                recordValueArray.fields.push({keyIn : 0, value :  record.Owner.Name});
                let keyForHtml = 1;
                Object.keys(this.mapColumns).map(fieldName => {
                    if (record.hasOwnProperty(fieldName)) {
                        recordValueArray.fields.push({keyIn : keyForHtml, value :  record[fieldName]});
                        // recordValueArray.fields.push(record[fieldName]);
                    }else{
                        recordValueArray.fields.push({keyIn : keyForHtml, value :  ' '});
                    }
                    keyForHtml++;
                });
                this.tableData.push(recordValueArray);
            });
            this.originalTableData = JSON.parse(JSON.stringify(this.tableData))
            return true;
        }
        this.toastEvent('error', 'Error!', 'No records found for the selected user on this object!');
        return false;
    }

    clearSelections() {
        this.selectedRecordIds = [];
        this.tableColumns = [];
        this.tableData = [];
        this.showAssignToUserTab = false;
        this.hasInitialized = false;
    }

    handleObjectChange(event){
        this.objectApiName = event.target.value;
        console.log(this.objectApiName);
        // Retrieve the label based on the value
        this.objectOptions.forEach(item => {
            if (item.value == this.objectApiName) {
                this.objectLabel = item.label
            }
          //  item.value == this.objectApiName ? this.objectLabel = item.label : this.objectLabel = '';
        });
        console.log('objectLabel:', this.objectLabel);
        if(this.userId && this.userId != '' && this.objectApiName && this.objectApiName != ''){
            this.handleSearch();
        }
        this.clearSelections();
        //this.showAssignToUserTab = Boolean(this.objectApiName);
    }

    onUserChange(event){
        try {
            this.userId = event.detail.recordId;
            console.log('User id --- ' + this.userId);
            if (this.userId != null && this.userId != '') {
                this.showObjectField = true;
            }else{
                //this.showObjectField = false;
                // const childComponent = this.template.querySelector('c-searchable-picklist-lwc[data-id="searchablePicklist"]');
                // if(childComponent){
                //     childComponent.clearValue();
                //     this.objectApiName = '';
                // }
            }
            //this.clearSelections();
            this.selectedRecordIds = [];
            this.tableData = [];
            this.showAssignToUserTab = false;
            if(this.userId != null && this.userId != '' && this.objectApiName  != null && this.objectApiName != ''){
                this.handleSearch();
            }
        } catch (error) {
            console.log(error);
        }
    }


    onUserChangeBulk(event){
        this.bulkUserId = event.detail.recordId;
        this.handleButton()
    }

    
    
    handleButton(){
        if(this.listSelectedObjects && this.listSelectedObjects.length > 0 && this.bulkUserId && this.bulkUserId != '' && this.assigneeUserBulkId && this.assigneeUserBulkId != '' )
            this.showBulkAssignButton = true;
        else
            this.showBulkAssignButton = false;
    }
    

    // removePillFromRow(event){
    //     let index = event.target.dataset.index;
    //     console.log('index -- '+index);
    //     this.listSelectedObjects = this.listSelectedObjects.filter(
    //         (item, idx) => idx !== parseInt(index, 10)
    //     );
    //     console.log('listPills -- '+this.listSelectedObjects);
    //     if (this.listSelectedObjects.length < 1) {
    //         this.showPill = false;
    //     }
    // }

    assigneeUserBulkId = ''
    onAssigneeUserChangeBulk(event) {
        this.assigneeUserBulkId = event.detail.recordId;
        console.log('Assignee user Bulk id --- ' + this.assigneeUserId);
        this.handleButton()
    }

    showAssignButton = false;
    onAssigneeUserChange(event) {
        this.assigneeUserId = event.detail.recordId;
        if(this.assigneeUserId && this.assigneeUserId != ''){
            this.showAssignButton = true;
        }else{
            this.showAssignButton = false;
        }
        console.log('Assignee user id --- ' + this.assigneeUserId);
    }

    handleActiveTab(event) {
        const tab = event.target.value;
        console.log('Current tab --- ' + tab);
        this.currentTab = tab;
    }

    handleNext() {
        this.currentTab = 'assign-to-user';
    }

    handleCheckboxSelection(event) {
        const checked = event.target.checked;
        const recordId = event.target.value;
        if (checked) {
            this.selectedRecordIds.push(recordId)
        }else{
            this.selectedRecordIds = this.selectedRecordIds.filter(id => id !== recordId);
        }
        this.showAssignToUserTab = Boolean(this.selectedRecordIds.length);
        console.log(this.selectedRecordIds);
    }


    handleCheckboxAllSelection(event) {
        const checked = event.target.checked;
        this.showAssignToUserTab = checked;
        for (let index = 0; index < this.tableData.length; index++) {
            this.tableData[index].checked = checked;
            if (checked) {
                this.selectedRecordIds.push(this.tableData[index].id)
            }else{
                this.selectedRecordIds = this.selectedRecordIds.filter(id => id !== this.tableData[index].id);
            }
        }

        console.log(this.selectedRecordIds);
    }



    /*
    allowReassignment() {
        let error = '';

        if(!this.assigneeUserId) {
            error = 'Please select a user to assign the records to!';
        }

        return error;
    }
    */

    handleOwnerChange(event) {
        this.isLoading = true;
        for (let index = 0; index < this.tableData.length; index++) {
            if (this.tableData[index].checked) {
                this.selectedRecordIds.push(this.tableData[index].id);
            }
        }
        if(this.assigneeUserId && this.selectedRecordIds.length && (this.assigneeUserId != this.userId)) {
            console.log('Records to re-assign --- ' + this.selectedRecordIds);
            console.log('Assignee --- ' + this.assigneeUserId);

            updateOwnerOfRecords({sObjectName : this.objectApiName, newOwnerId : this.assigneeUserId, recordIds : this.selectedRecordIds})
            .then((result)=>{
                console.log('result==='+result);
                this.isLoading = false;

                this.handleSearch();

                this.toastEvent('success', 'Success!', 'Owner changed successfully!');
            }).catch((error) => {
                this.isLoading = false;
                console.log("Error : " + JSON.stringify(error));
                this.handleError(error);
            });

        } else {
            if(!this.assigneeUserId) {
                this.toastEvent('error', 'Error!', 'Please select a user to assign the records to!');
            }

            if(!this.selectedRecordIds.length) {
                this.toastEvent('error', 'Error!', 'Please select records for re-assignment!');
            }

            if(this.assigneeUserId == this.userId && this.selectedRecordIds.length) {
                this.toastEvent('error', 'Error!', 'User already the owner of the selected records!');
            }

            this.isLoading = false;
        }
    }

    handleOwnerChangeBulk(){
        this.isLoading = true;
        this.listSelectedObjects = [];
        this.objectOptions.forEach(element => {
            this.listSelectedObjects.push(element.value);
        });
        updateOwnerOfRecordsBulk({listSObject : this.listSelectedObjects, newOwnerId : this.assigneeUserBulkId, oldOwnerId : this.bulkUserId})
        .then((result)=>{
            if (result) {
                this.toastEvent('success', 'Success!', 'Bulk Owner change job has been Initiated successfully!');
            }
            this.isLoading = false;
        }).catch((error) => {
            this.isLoading = false;
            console.log("Error : " + JSON.stringify(error));
            this.handleError(error);
        });
    }

    // this.toastEvent('success', 'Success!', message);
    toastEvent(type,title, message){
        const evt = new ShowToastEvent({
            title: title,
            message: message,
            variant: type
        });
        this.dispatchEvent(evt);
    }

    handleError(error) {
        if (error) {
            let tempErrorList = [];
            if (Array.isArray(error.body)) {
                tempErrorList = error.body.map((e) => e.message);
            } 
            else if (error.body && typeof error.body.message === 'string') {
                tempErrorList = [error.body.message];
            } 
            else if (error.body && error.body.fieldErrors && error.body.fieldErrors.message) {
                console.log('fielderror');
                tempErrorList = Object.values(error.body.fieldErrors)
                    .flat() 
                    .map((fieldError) => fieldError.message);
            }
            else if (Array.isArray(error.body.pageErrors) && error.body.pageErrors.length > 0) {
                tempErrorList = error.body.pageErrors.map((e) => e.message);
            }
            else if (typeof error.message === 'string') {
                tempErrorList = [error.message];
            }
            tempErrorList;
            // Pass the error messages to toastEvent or display logic
            this.toastEvent('error', 'Error!', tempErrorList.join(', '));
        }
        
        this.isLoading = false;
    }

    isInputValid() {
        let isValid = true;
        let inputFields = this.template.querySelectorAll('.validate-input');
        // inputFields.push(this.template.querySelectorAll('lightning-combobox'));
        inputFields.forEach(inputField => {
            if (!inputField.checkValidity()) {
                inputField.reportValidity();
                isValid = false;
            }
        });
        return isValid;
    }
}