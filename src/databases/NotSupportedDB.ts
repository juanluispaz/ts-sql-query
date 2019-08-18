export interface NotSupportedDB {
    /*
     * If you got here is because the method invoced next to the
     * error message is not supperted by the database used in the
     * connection, you are trying to use a feature recerved for
     * other database
     */
    __NextMethodNotSupportedByThisConnection: 'NotSupportedDB'
}