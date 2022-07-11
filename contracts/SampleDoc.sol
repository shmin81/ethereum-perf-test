// SPDX-License-Identifier: MIT
/* BMT 기능테스트용 */
pragma solidity >=0.5.0 <=0.8.18;

// compile with:
// solcjs SampleDoc.sol --bin --abi --optimize --overwrite -o .
// solc SampleDoc.sol --evm-version istanbul --bin --abi --optimize --overwrite -o .

contract SampleDoc {

    struct Document {
        uint256 id;
        bytes32 fileHash;
        bytes32 fileNameHash;
        uint256 regTimestamp;
        uint256 expTimestamp;
        address owner;
        bool    isActive;
    }

    mapping(uint256 => Document) documents;
    mapping(address => uint256) documentCounts;
    mapping(uint256 => uint256) documentUpdateCounts;

    event CreateDocument (
        uint256 id,
        address owner,
        uint256 count,
        bytes32 fileHash,
        uint256 expTimestamp
    );

    event UpdateDocument (
        uint256 id,
        address owner,
        uint256 count,
        bytes32 fileHash,
        uint256 expTimestamp
    );

    event DeleteDocument (
        uint256 id,
        address owner  
    );

    /**
     * 문서 정보를 생성한다.
     *
     * @param _id 외부에서 정의한 파일ID (uint256)
     * @param _fileHash 문서파일의 Hash 값 (bytes32)
     * @param _expTimestamp 문서가 만료되는 시간기록 (GMT기준, uint256)
     */
    // TO-DO: regTimestamp를 저장할 필요가 있을까? createDocument가 처리된 시점의 블록 생성 시점을 확인하면 될 듯 <= 어떻게 확인할 수 있을지도 정리 필요
    // TO-DO: 아래 예제 데이터 문서화 할 것
    // SHA256 Hash: 1 => 0x6B86B273FF34FCE19D6B804EFF5A3F5747ADA4EAA22F1D49C01E52DDB7875B4B
    // SHA256 Hash: 2 => 0xD4735E3A265E16EEE03F59718B9B5D03019C07D8B6C51F90DA3A666EEC13AB35
    // Timestamp: Saturday, 31 December 2022 23:59:59 => 1672531199	(미래)
    // Timestamp: Friday, 31 December 2021 23:59:59 => 1640995199 (과거)

    function createDocument (
        uint256 _id,
        bytes32 _fileHash,
        uint256 _expTimestamp
    ) public {
        require( documents[ _id ].isActive == false, "ERROR_DOCUMENT_ID_EXISTS" ) ;
        require( _expTimestamp <= block.timestamp, "ERROR_DOCUMENT_EXPIRED" );

        documentCounts[msg.sender] += 1;

        documents[ _id ].id = _id ;
        documents[ _id ].fileHash = _fileHash ;
        documents[ _id ].fileNameHash = ~_fileHash ;
        documents[ _id ].regTimestamp = block.timestamp ;
        documents[ _id ].expTimestamp = _expTimestamp ;
        documents[ _id ].owner = msg.sender ;
        documents[ _id ].isActive = true ;

        emit CreateDocument(_id, msg.sender, documentCounts[msg.sender], _fileHash, _expTimestamp);
    }

    function updateDocument (
        uint256 _id,
        bytes32 _fileHash,
        uint256 _expTimestamp
    ) public {
        require( documents[ _id ].isActive == true, "ERROR_DOCUMENT_NOT_EXISTS" ) ;
        require( documents[ _id ].owner == msg.sender, "WRONG OWNER" );
        require( documents[ _id ].expTimestamp >= block.timestamp, "ERROR_DOCUMENT_EXPIRED" );

        documentUpdateCounts[ _id ] += 1 ;

        documents[ _id ].fileHash = _fileHash ;
        documents[ _id ].fileNameHash = ~_fileHash ;
        documents[ _id ].regTimestamp = block.timestamp ;
        documents[ _id ].expTimestamp = _expTimestamp ;

        emit UpdateDocument(_id, msg.sender, documentUpdateCounts[ _id ], _fileHash, _expTimestamp);
    }

    /**
     * 문서 정보를 삭제하는 함수로 입력 받은 파일ID에 해당하는 Document 구조체 내 활성화(isActive) 여부를 false로 설정한다.
     *
     * @param _id 삭제할 파일ID (uint)
     */
    function deleteDocument (
        uint256 _id
    ) public {
        require( documents[ _id ].isActive == true, "ERROR_DOCUMENT_NOT_EXISTS" ) ;
        require( documents[ _id ].owner == msg.sender, "NO OWNER" );
        // (장기적인) TO-DO owner만이 삭제할 수 있음
        documents[ _id ].isActive = false;

        emit DeleteDocument( _id, msg.sender) ;
    }


    /**
     * 입력받은 문서ID, 문서Hash값을 블록체인에 저장되어 있는 데이터와 동일 여부와
     * 현재 시간(block.timestamp이 문서만료시점 이전인지를 확인함..
     *
     * @param _id 외부에서 정의한 파일ID (uint)
     * @param _fileHash 문서파일의 Hash 값 (bytes32)
     * @return uint256 0: Valid Document, 1: Document hash is different, 2: Document is expired
     */
    function checkDocument(
        uint256 _id,
        bytes32 _fileHash
    )   public
        view
        returns (uint256) {
        require( documents[ _id ].isActive == true, "ERROR_DOCUMENT_NOT_EXISTS" ) ;

        Document memory document = documents[_id];
        if( block.timestamp >= document.expTimestamp ) {
          return 2;     // Document is expired
        } else if( document.fileHash != _fileHash ) {
          return 1;     // Document hash is different 
        } else {
          return 0;     // Valid Document
        }
    }


    /**
     * 입력받은 문서ID에 해당하는 문서의 정보를 리턴한다.
     *
     * @param _id 외부에서 정의한 파일ID (uint256)
     * @return
     *  id 문서ID(uint256)
     *  fileHash 문서Hash값(bytes32)
     *  regTimestamp 문서가 등록된 시간기록(GMT기준, uint256)
     *  expTimestamp 문서가 만료되는 시간기록(GMT기준, uint256)
     *  owner 소유자address(address)
     *  isActive 활성화여부(bool)
     */
     // TO-DO: 삭제된 문서도 조회 가능할 것인가?
     //        owner 만 조회가능하게 해 줄 것인가?
    function getDocument(uint256 _id)
        public
        view
        returns (
            uint256 id,
            bytes32 fileHash,
            uint256 regTimestamp,
            uint256 expTimestamp,
            address owner,
            bool isActive
        )
    {
        //require( documents[ _id ].isActive == true, "ERROR_DOCUMENT_NOT_EXISTS" ) ;

        Document memory document = documents[_id];

        return (
            document.id,
            document.fileHash,
            document.regTimestamp,
            document.expTimestamp,
            document.owner,
            document.isActive
        );
    }

    function getDocumentCount(address _owner)
        public
        view
        returns (uint256)
    {
        return documentCounts[_owner];
    }
    
}
