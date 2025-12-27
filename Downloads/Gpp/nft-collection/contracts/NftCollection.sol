// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract NftCollection is ERC721, Ownable, Pausable {
    using Strings for uint256;

    uint256 public maxSupply;
    uint256 public totalSupply;
    string private baseTokenURI;

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 maxSupply_,
        string memory baseURI_
    ) ERC721(name_, symbol_) {
        require(maxSupply_ > 0, "Max supply must be > 0");
        maxSupply = maxSupply_;
        baseTokenURI = baseURI_;
    }

    // --------------------
    // Minting
    // --------------------
    function safeMint(address to, uint256 tokenId)
        external
        onlyOwner
        whenNotPaused
    {
        require(to != address(0), "Mint to zero address");
        require(!_exists(tokenId), "Token already minted");
        require(totalSupply < maxSupply, "Max supply reached");

        totalSupply += 1;
        _safeMint(to, tokenId);
    }

    // --------------------
    // Pause control
    // --------------------
    function pauseMinting() external onlyOwner {
        _pause();
    }

    function unpauseMinting() external onlyOwner {
        _unpause();
    }

    // --------------------
    // Metadata
    // --------------------
    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(_exists(tokenId), "URI query for nonexistent token");
        return string(abi.encodePacked(baseTokenURI, tokenId.toString()));
    }
}
