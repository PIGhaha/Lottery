# Lottery
## 说明：
- 合约部署在Rinkeby测试网，地址为：0xa3F60C5c39D40396F02E3a0E886356345D63386d。

- 由管理员发起彩票活动并设置开奖时间，需由管理员手动开奖。开奖时间后无法下注，开奖时间前不能开奖。若某期彩票无人获奖，则奖池将流入下一期。

- 每个参与者每次投资5DAI购买一注彩票，一个参与者可多注购买相同/不同彩票数字，下注前需要提前授权DAI额度。

- 彩票数字由4位0-9之间的数字构成，中奖数字由chainlink VRF随机生成。中奖者按购买数字的注数平分奖池，平台收取20%手续费。

- 管理员可多次发起彩票活动，但是同一时间仅支持一个彩票活动存在。

- 可查询往期彩票中将数字和中奖者。



## 参考文献：
- *Alex Roan. How to Generate Random Numbers on Ethereum Using VRF.May 19, 2020.* https://medium.com/coinmonks/how-to-generate-random-numbers-on-ethereum-using-vrf-8250839dd9e2

- *Alex Roan. Build a Verifiably Random Lottery Smart Contract on Ethereum. Jun 2, 2020.* https://betterprogramming.pub/build-a-verifiably-random-lottery-smart-contract-on-ethereum-c1daacc1ca4e

- *Chainlink doc. Get a Random Number.* https://docs.chain.link/docs/get-a-random-number/

- *Chainlink doc. Contract Addresses*. https://docs.chain.link/docs/vrf-contracts/
