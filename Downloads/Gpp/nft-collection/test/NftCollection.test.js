const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NftCollection", function () {
  let nft;
  let owner, addr1, addr2;

  const NAME = "MyNFT";
  const SYMBOL = "MNFT";
  const MAX_SUPPLY = 2;
  const BASE_URI = "https://example.com/meta/";

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const NftCollection = await ethers.getContractFactory("NftCollection");
    nft = await NftCollection.deploy(NAME, SYMBOL, MAX_SUPPLY, BASE_URI);

    // ✅ ethers v6 replacement for nft.deployed()
    await nft.waitForDeployment();
  });

  it("should set correct name and symbol", async function () {
    expect(await nft.name()).to.equal(NAME);
    expect(await nft.symbol()).to.equal(SYMBOL);
  });

  it("owner can mint NFT", async function () {
    await nft.safeMint(addr1.address, 1);

    expect(await nft.ownerOf(1)).to.equal(addr1.address);
    expect(await nft.totalSupply()).to.equal(1);
  });

  it("non-owner cannot mint", async function () {
    await expect(
      nft.connect(addr1).safeMint(addr1.address, 1)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("cannot mint beyond max supply", async function () {
    await nft.safeMint(addr1.address, 1);
    await nft.safeMint(addr2.address, 2);

    await expect(
      nft.safeMint(owner.address, 3)
    ).to.be.revertedWith("Max supply reached");
  });

  it("tokenURI returns correct value", async function () {
    await nft.safeMint(addr1.address, 1);

    expect(await nft.tokenURI(1)).to.equal(BASE_URI + "1");
  });

  it("owner can transfer token", async function () {
    await nft.safeMint(owner.address, 1);

    await nft.transferFrom(owner.address, addr1.address, 1);

    expect(await nft.ownerOf(1)).to.equal(addr1.address);
  });

  it("unauthorized transfer should fail", async function () {
    await nft.safeMint(owner.address, 1);

    await expect(
      nft.connect(addr1).transferFrom(owner.address, addr1.address, 1)
    ).to.be.reverted;
  });
});
