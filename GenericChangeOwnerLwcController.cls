/**
* Summary: This controller class provides backend logic for the Lightning Web Component 
* that facilitates owner reassignment for various Salesforce records. 
* Class Access: No limitations/Profile-specific restrictions
* Author: Asjad Ahmed
* Company: Olympus
* Created: 05.10.2024
* History
* <Date> <Author's Name> <Jira #> <Brief Description of Change>
* 05.10.2024 Asjad Ahmed N/A Initial version of the class.
*
**/
public class GenericChangeOwnerLwcController {
    
    public static Map<String, String> mapColumnsAPIToLabel;
    
    /**
    * Summary: Initializes the component by fetching the picklist values for available objects.
    * Inputs: None
    * Returns: JSON string containing a list of object picklist options.
    * Author: Asjad Ahmed
    * Company: Olympus
    * Created: 25.11.2024
    **/
    @AuraEnabled
    public static String initialize(){
        MainWrapper objMain = new MainWrapper();
        objMain.lstObjectPicklist = getObjects();
        return JSON.serialize(objMain);    
    }


    /**
    * Summary: Retrieves a list of objects accessible and searchable by the user.
    * Inputs: None
    * Returns: List of ObjectPicklist containing object labels and API names.
    * Author: Asjad Ahmed
    * Company: Olympus
    * Created: 25.11.2024
    **/
    public static List<ObjectPicklist> getObjects(){
        //Map<String, List<String> sObjFieldMap = new Map<String, List<String>();
        MainWrapper objMain = new MainWrapper();
        List<ObjectPicklist> listPicklist = new List<ObjectPicklist>();
        map<string, SObjectType> objs = schema.getGlobalDescribe();
        for(SObjectType eachSobjectType : objs.values())
        {
            if(eachSobjectType.getDescribe().isAccessible() && eachSobjectType.getDescribe().isCreateable() && eachSobjectType.getDescribe().isSearchable())
            {
                ObjectPicklist obj = new ObjectPicklist();
                obj.label = eachSobjectType.getDescribe().getLabel();
                obj.value = eachSobjectType.getDescribe().getName();
                listPicklist.add(obj);
            }
        }
        return listPicklist;
    }


    /**
    * Summary: Searches for records of a given object owned by a specific owner.
    * Inputs: 
    * - sObjectName: Name of the object to search.
    * - ownerId: Owner ID to filter records.
    * Returns: JSON string containing matching records and their metadata.
    * Author: Asjad Ahmed
    * Company: Olympus
    * Created: 25.11.2024
    **/
    @AuraEnabled
    public static String searchForRecords(String sObjectName, String ownerId){
        Set<String> serviceContractRecordTypeName = new Set<String>{'Silver CMC Contract (SCMC)', 'Comprehensive Maintenance Contract (CMC)', 'Annual Maintenance Contract (AMC)'};
        Set<String> serviceOpportunityRecordTypeName = new Set<String>{'Service Quotation Opportunity', 'Sales of Accessories Opportunity'};
        Set<String> serviceQuoteRecordTypeName = new Set<String>{'Annual Maintenance Quotation', 'Comprehensive Maintenance Quotation', 'Indirect AMC Quotation', 'Indirect CMC Quotation', 'Indirect Silver CMC Quotation', 'Onsite Repair Quotation', 'Sales of Accessories Quotation', 'Silver CMC Quotation'};
        Set<String> fNSStatus = new Set<String>{'Received', 'Assigned'};
        String repairOpportunityRecordType = 'Repair Opportunity';
        String repairOpportunityCaseStatus = 'Closed';
        String iOStatusApproved = 'Approved';
        String invoiceNumber = '';
        if (String.isNotBlank(sObjectName)) {
            if(sObjectName == 'Repair Opportunity') {
                sObjectName = 'Opportunity';
            }
            MainWrapper objMain = new MainWrapper();
            String queryString = getQueryString(sObjectName, ownerId);
            System.debug(queryString);
            objMain.listRecords = Database.query(String.escapeSingleQuotes(queryString));
            objMain.mapColumnsAPIToLabel = mapColumnsAPIToLabel;
            return JSON.serialize(objMain);
        }
        return null ;
    }

    /**
    * Summary: Updates the owner of selected records for a specific object.
    * Inputs: 
    * - sObjectName: Name of the object.
    * - newOwnerId: ID of the new owner.
    * - recordIds: List of record IDs to update.
    * Returns: Null
    * Author: Asjad Ahmed
    * Company: Olympus
    * Created: 25.11.2024
    **/
    @AuraEnabled
    public static String updateOwnerOfRecords(String sObjectName, String newOwnerId, List<String> recordIds){
        if (String.isNotBlank(sObjectName)) {
            Set<String> tempSet = new Set<String>(recordIds);
            List<SObject> listRecords;
            recordIds = new List<String>(tempSet);
            String queryString = String.format('SELECT OwnerId FROM {0} WHERE Id IN :recordIds WITH SECURITY_ENFORCED', new List<String>{sObjectName});
            String [] FieldsToQuery = new String [] {'OwnerId' };
            if((!OlympusUtilityApex.CheckFieldPermission(sObjectName,'isAccessible',null,true)) && (!OlympusUtilityApex.CheckFieldPermission(sObjectName,'isAccessible',FieldsToQuery,false))){
                throw new AuraHandledException('User : Insufficient Privileges. You do not have the level of access necessary to perform the operation you requested.');
            }else{
                listRecords = Database.query(String.escapeSingleQuotes(queryString));
            }
            for(SObject record : listRecords) {
                record.put('OwnerId', newOwnerId);
            }

            if(!OlympusUtilityApex.CheckFieldPermission(sObjectName,'isAccessible',null,true) 
            && (!OlympusUtilityApex.CheckFieldPermission(sObjectName,'isAccessible',FieldsToQuery, false)) 
            && (!OlympusUtilityApex.CheckFieldPermission(sObjectName,'isUpdateable',null, true)) 
            && (!OlympusUtilityApex.CheckFieldPermission(sObjectName,'isUpdateable',FieldsToQuery, false)) ){
                throw new AuraHandledException('User : Insufficient Privileges. You do not have the level of access necessary to perform the operation you requested.');
            }else{
                Database.UPDATE( listRecords, AccessLevel.SYSTEM_MODE);
            }
        }
        return null;
    }

    /**
    * Summary: Bulk updates the owner of records for multiple objects.
    * Inputs: 
    * - listSObject: List of object names.
    * - newOwnerId: ID of the new owner.
    * - oldOwnerId: ID of the current owner to replace.
    * Returns: Job ID of the queued job.
    * Author: Asjad Ahmed
    * Company: Olympus
    * Created: 25.11.2024
    **/
    @AuraEnabled
    public static String updateOwnerOfRecordsBulk(List<String> listSObject, String newOwnerId, String oldOwnerId){
        if (listSObject == null || listSObject.isEmpty()) {
            throw new AuraHandledException('Error: No sObjects provided.');
        }
        String jobId = null;
        for (String sObjectName : listSObject) {
            jobId = System.enqueueJob(new AssignOwnerBulkQueue(sObjectName, newOwnerId, oldOwnerId));
        }
        return jobId;
    }
    

    /**
    * Summary: Generates a dynamic SOQL query string to fetch records for owner reassignment.
    * Inputs: 
    * - sObjectName: Name of the object.
    * - ownerId: Owner ID to filter records.
    * Returns: String containing the SOQL query.
    * Author: Asjad Ahmed
    * Company: Olympus
    * Created: 25.11.2024
    **/
    public static String getQueryString(String sObjectName, String ownerId){
        List<String> FieldsToQuery = new List<String>();
        String fieldSetName = 'Assign_Component_FieldSet';
        String queryString = 'SELECT Id, Owner.Name';
        Map<String, Schema.SObjectType> GlobalDescribeMap = Schema.getGlobalDescribe(); 
        Schema.SObjectType SObjectTypeObj = GlobalDescribeMap.get(sObjectName);
        Schema.DescribeSObjectResult DescribeSObjectResultObj = SObjectTypeObj.getDescribe();
        Schema.FieldSet fieldSetObj = DescribeSObjectResultObj.FieldSets.getMap().get(fieldSetName);
        if (fieldSetObj != null) {
            mapColumnsAPIToLabel = new Map<String, String>();
            for(Schema.FieldSetMember fld : fieldSetObj.getFields()) {
                FieldsToQuery.add(fld.getFieldPath());
                queryString += ', ' + fld.getFieldPath();
                mapColumnsAPIToLabel.put(fld.getFieldPath(), fld.getLabel());
            }
            queryString = queryString +' FROM '+sObjectName ;
            if (String.isNotBlank(ownerId)) {
                String whereClause = generateOwnerChangeWhereClause(sObjectName);
                if (String.isNotBlank(whereClause))
                    queryString = queryString +whereClause;
            }
            if((!OlympusUtilityApex.CheckFieldPermission(sObjectName,'isAccessible',null,true)) && (!OlympusUtilityApex.CheckFieldPermission(sObjectName,'isAccessible',FieldsToQuery,false))){
                throw new AuraHandledException('User : Insufficient Privileges. You do not have the level of access necessary to perform the operation you requested.');
            }else{
                System.debug('queryString '+ queryString);
                return queryString;
            }
        }else {
            throw new AuraHandledException('No FieldSet found on this object, please create one with "Assign_Component_FieldSet" name before using assignment component!');
        }
    }

    /**
    * Summary: Generates the WHERE clause for the owner change query based on the object type.
    * Inputs: 
    * - objectName: Name of the object.
    * Returns: String containing the WHERE clause.
    * Author: Asjad Ahmed
    * Company: Olympus
    * Created: 25.11.2024
    **/
    public static String generateOwnerChangeWhereClause(String objectName){
        
        if (objectName == 'Account' || objectName == 'Asset' ) {
            return ' WHERE OwnerId = :ownerId WITH SECURITY_ENFORCED LIMIT 50000';
        }
        else if (objectName == 'ServiceContract') {
            return ' WHERE OwnerId = :ownerId AND RecordType.Name IN: serviceContractRecordTypeName AND Id IN (SELECT Service_Contract__c FROM Billing_Plan__c WHERE Invoice_Number__c =: invoiceNumber) LIMIT 50000';
        }
        else if (objectName == 'Quote') {
            return ' WHERE OwnerId = :ownerId AND RecordType.Name IN: serviceQuoteRecordTypeName AND Id NOT IN  (SELECT QuoteId__c FROM ServiceContract ) LIMIT 50000';
        }
        else if (objectName == 'Opportunity') {
            return ' WHERE OwnerId = :ownerId AND RecordType.Name IN: serviceOpportunityRecordTypeName AND Id NOT IN (SELECT Opportunity__c FROM ServiceContract) LIMIT 50000';
        }
        else if (objectName == 'Repair Opportunity') {
            return ' WHERE OwnerId = :ownerId AND RecordType.Name =: repairOpportunityRecordType AND FS_Notification__r.Status !=: repairOpportunityCaseStatus LIMIT 50000';
        }
        else if (objectName == 'Installation_Order__c') {
            return ' WHERE OwnerId = :ownerId AND Status__c !=: iOStatusApproved LIMIT 50000';
        }
        else if (objectName == 'Case') {
            return ' WHERE OwnerId = :ownerId AND Status =: fNSStatus LIMIT 50000';
        }
        else if (objectName == 'WorkOrder') {
            return ' WHERE OwnerId = :ownerId LIMIT 50000';
        }
        return null;
    }

    /**
    * Summary: Wrapper class to organize the response structure.
    * Properties:
    * - lstObjectPicklist: List of object picklist options.
    * - listRecords: List of queried records.
    * - mapColumnsAPIToLabel: Map of API names to field labels.
    * Author: Asjad Ahmed
    * Company: Olympus
    * Created: 25.11.2024
    **/
    public class MainWrapper{
        public List<ObjectPicklist> lstObjectPicklist;
        public List<SObject> listRecords;
        public Map<String, String> mapColumnsAPIToLabel;
    }

    public class ObjectPicklist{
        public String label;
        public String value;
    }
}