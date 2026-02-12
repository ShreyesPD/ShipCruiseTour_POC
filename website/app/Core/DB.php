<?php
require_once(LIBS . 'DB/MysqliDb.php');

class DB
{
    protected $db;

    public function connect(): false|MysqliDb
    {
        $database = new MysqliDb(HOST, USER, PASS, DBNAME, defined('PORT') ? PORT : 3306);
        if (!$database->connect()) {
            $this->db = $database;
            return $this->db;
        }

        echo 'error connecting';
        return false;
    }
}


