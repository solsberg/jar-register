import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import classNames from 'classnames';
import moment from 'moment';
import get from 'lodash/get';
import { formatMoney, getEarlyDiscount, getPreRegistrationDiscount, isRoomUpgradeAvailable } from '../lib/utils';
import SignIn from '../components/SignIn';
import LodgingCard from './LodgingCard';
import MoneyField from './MoneyField';
import ROOM_DATA from '../roomData.json';
import { LOADED } from '../constants';
import './RoomChoice.css';
import { has } from 'lodash-es';

class RoomChoice extends Component {
  componentWillMount() {
    this.setState({
      submitted: false,
      announcement: null,
      waitingForRegistration: false,
      roomChoice: this.props.order.roomChoice,
      singleSupplement: !!this.props.order.singleSupplement,
      refrigeratorSelected: !!this.props.order.refrigerator,
      thursdayNight: !!this.props.order.thursdayNight,
      roommate: this.props.order.roommate || '',
      donation: this.props.order.donation,
      isCustomDonation: this.props.order.roomChoice === "online_base" && this.props.order.donation > 0,
      donationOption: this.inferDonationOption(this.props.order)
    });
  }

  componentWillReceiveProps(nextProps) {
    const { order, currentUser } = this.props;
    if (!order.roomChoice && !!nextProps.order.roomChoice) {
      this.setState({
        roomChoice: nextProps.order.roomChoice,
        singleSupplement: !!nextProps.order.singleSupplement,
        refrigeratorSelected: !!nextProps.order.refrigerator,
        thursdayNight: !!nextProps.order.thursdayNight,
        roommate: nextProps.order.roommate || '',
        donation: nextProps.order.donation,
        isCustomDonation: nextProps.order.roomChoice === "online_base" && nextProps.order.donation > 0,
        donationOption: this.inferDonationOption(nextProps.order)
      });
    }
    if (((!currentUser && !!nextProps.currentUser) || this.state.waitingForRegistration) &&
        this.state.submitted) {
      if (nextProps.registrationStatus === LOADED) {
        if (!nextProps.order.roomChoice) {
          if (!!nextProps.bambam && !!nextProps.bambam.inviter) {
            this.setState({
              submitted: false,
              announcement: this.getBamBamMessage(nextProps.bambam)
            });
          } else {
            this.apply(nextProps.currentUser);
          }
        } else {
          this.setState({
            submitted: false,
            announcement: 'We found your existing registration.'
          });
        }
      } else {
        this.setState({ waitingForRegistration: true });
      }
    } else if (!!currentUser && !nextProps.currentUser) {
      //clear current state when signing out
      this.setState({
        submitted: false,
        announcement: null,
        waitingForRegistration: false,
        roomChoice: null,
        singleSupplement: false,
        refrigeratorSelected: false,
        thursdayNight: false,
        roommate: '',
        donation: null,
        isCustomDonation: false,
        donationOption: null
      });
    } else if (!nextProps.order.created_at && !!nextProps.bambam && !!nextProps.bambam.inviter) {
      this.setState({
        announcement: this.getBamBamMessage(nextProps.bambam)
      });
    }
  }

  inferDonationOption = ({ roomChoice, donation }) => {
    if (!roomChoice) {
      return null;
    } else if (donation === 36000) {
      return "donation_mishpacha";
    } else if (donation === 18000) {
      return "donation_endowment";
    } else if (donation === 9000) {
      return "donation_support";
    } else if (donation > 0) {
      return "donation_custom";
    } else {
      return "donation_none";
    }
  }

  getBamBamMessage = (bambam) => {
    const {event, serverTimestamp} = this.props;

    const name = `${bambam.inviter.first_name} ${bambam.inviter.last_name}`;
    let message = `You have been invited to join us at ${event.title} by ${name} as part of ` +
      "our 'Be a Mensch, Bring a Mensch' program.";
    if (moment(serverTimestamp).isSameOrBefore(moment(bambam.inviter.invited_at)
        .add(event.bambamDiscount.registerByAmount, event.bambamDiscount.registerByUnit)
        .endOf('day'))) {
      message += ` You will each receive a ${event.bambamDiscount.amount * 100}% discount on your ` +
        "room rate when you complete your registration.";
    }
    return message;
  }

  handleSubmit = (evt) => {
    if (evt) {
      evt.preventDefault();
    }
    this.setState({
      submitted: true
    });
    if (this.props.currentUser) {
      this.apply(this.props.currentUser);
    }
  }

  apply = (currentUser) => {
    const { history, match, event, applyRoomChoice, madePayment } = this.props;
    const { roomChoice, singleSupplement, refrigeratorSelected, thursdayNight, roommate, donation, isCustomDonation, donationOption } = this.state;

    let orderValues = {
      roomChoice,
      singleSupplement: !!singleSupplement && !!event.priceList.singleRoom[roomChoice],
      refrigerator: !!refrigeratorSelected && roomChoice !== 'camper' && roomChoice !== 'commuter',
      thursdayNight: !!thursdayNight && roomChoice !== 'commuter',
      roommate
    };
    if (event.onlineOnly) {
      orderValues.donation = isCustomDonation ? donation : null;
    } else if (donationOption === "donation_mishpacha") {
      orderValues.donation = 36000;
    } else if (donationOption === "donation_endowment") {
      orderValues.donation = 18000;
    } else if (donationOption === "donation_support") {
      orderValues.donation = 9000;
    } else if (donationOption === "donation_custom") {
      orderValues.donation = donation;
    } else {
      orderValues.donation = null;
    }
    applyRoomChoice(event, currentUser, orderValues, madePayment);

    history.push(match.url + '/profile');
  }

  renderRoomChoiceOption = (roomType) => {
    const { roomChoice, singleSupplement } = this.state;
    const { event, order, serverTimestamp, roomUpgrade, currentUser } = this.props;

    const roomData = ROOM_DATA[roomType];
    let price = event.priceList.roomChoice[roomType];
    let strikeoutPrice;
    let discount = getPreRegistrationDiscount(currentUser, event, order, serverTimestamp) ||
        getEarlyDiscount(event, order, serverTimestamp);
    if (!!discount) {
      strikeoutPrice = price;
      if (discount.amount > 1) {
        price -= discount.amount;
      } else {
        price -= price * event.discount.amount;
      }
    }
    let upgradeType;
    if (isRoomUpgradeAvailable(roomUpgrade, order, event)) {
      upgradeType = roomData.upgradeTo && ROOM_DATA[roomData.upgradeTo].title;
    }
    let soldOut = get(event, `soldOut.${roomType}`, false) && order.roomChoice !== roomType;

    return (
      <LodgingCard
        roomType={roomType}
        title={roomData.title}
        description={roomData.description}
        price={price}
        strikeoutPrice={strikeoutPrice}
        roomUpgrade={upgradeType}
        priceSingle={event.priceList.singleRoom[roomType]}
        selected={roomChoice === roomType}
        singleSelected={!!singleSupplement}
        soldOut={!!soldOut}
        onClick={this.onSelectLodgingType}
        onToggleSingle={this.onToggleSingleSupplement}
      />
    );
  }

  onSelectLodgingType = (roomType) => {
    this.setState({roomChoice: roomType});
  }

  onSelectOnlineType = (roomType, isCustomDonation) => {
    this.setState({roomChoice: roomType, isCustomDonation});
  }

  onToggleSingleSupplement = () => {
    this.setState({singleSupplement: !this.state.singleSupplement});
  }

  onToggleRefrigerator = () => {
    this.setState({refrigeratorSelected: !this.state.refrigeratorSelected});
  }

  onToggleThursdayNight = () => {
    this.setState({thursdayNight: !this.state.thursdayNight});
  }

  handleChangeRoommate = (evt) => {
    evt.preventDefault();
    this.setState({roommate: evt.target.value});
  }

  handleDonationChange = (amount) => {
    this.setState({donation: amount});
  }

  onSelectDonationType = (option) => {
    const { donation } = this.state;

    let newState = {
      donationOption: option
    };
    if (option === "donation_custom" && [36000, 18000, 90000].indexOf(donation) >= 0) {
      newState["donation"] = null;
    }
    this.setState(newState);
  }

  renderOnlineJMR() {
    const { currentUser, event, serverTimestamp, madePayment, order, hasBalance, match } = this.props;
    const { roomChoice, announcement, isCustomDonation, donation } = this.state;

    let baseFee = event.priceList.roomChoice["online_base"];
    let baseLabel = "Basic Registration Fee";

    //only consider current time for message display
    let preRegistrationDiscount = getPreRegistrationDiscount(currentUser, event, order, serverTimestamp);
    if (!!preRegistrationDiscount) {
      if (preRegistrationDiscount.amount > 1) {
        baseFee -= preRegistrationDiscount.amount;
      } else {
        baseFee *= (1 - preRegistrationDiscount.amount);
      }
      baseLabel = "Pre-Registrant Early-Bird Registration Fee (register by July 31 to receive discount)";
    }
    let earlyDiscount = {};
    if (!preRegistrationDiscount) {
      earlyDiscount = getEarlyDiscount(event, null, serverTimestamp);
      if (!!earlyDiscount) {
        if (earlyDiscount.amount > 1) {
          baseFee -= earlyDiscount.amount;
        } else {
          baseFee *= (1 - earlyDiscount.amount);
        }
        baseLabel = `Registration Fee (register by ${moment(earlyDiscount.endDate).format("MMMM D")} to receive discount)`;
      }
    }
    let strikeoutFee = baseFee < event.priceList.roomChoice["online_base"] ? event.priceList.roomChoice["online_base"] : null;
    let canSubmit = !!roomChoice;
    if (roomChoice === "online_base" && isCustomDonation) {
      canSubmit = donation > 0;
    }

    return (
      <div className="mb-4">
        <div className="text-center offset-md-1 col-md-10 intro mb-3">
          <h5 className="font-italic">
            Menschwork invites you to join in the celebration of<br/>
          </h5>
          <h4 className="font-weight-bold">
            Jewish Men&#39;s Retreat 30
          </h4>
          <h5 className="font-weight-bold">
            <span className="text-primary">Resilience.</span>  Balance.  <span className="text-primary">Equanimity.</span>
          </h5>
          <h6 className="font-italic">
            This retreat will take place on-line
          </h6>
          <h6 className="font-italic">
            Friday October 15 at 4pm until Sunday October 17 at 2pm, 2021 (times approximate)
          </h6>
        </div>
        {!!announcement &&
          <div className="alert alert-info" role="alert">
            <p className="text-center m-0">{announcement}</p>
          </div>
        }
        {!!hasBalance &&
          <div className="alert alert-info" role="alert">
            <p className="text-center m-0">
              Please <Link to={`${match.url}/payment`}>visit the Payment page</Link> to pay the remaining balance on your registration
            </p>
          </div>
        }
        <div className="offset-md-1 col-md-10">
          <h5>Fee Options</h5>
          <p>
            Please indicate below the level at which you would like to contribute to the cost of putting on JMR30.
          </p>
          <p>
            All men who register will receive the JMR30 Package, a thoughtfully
            curated group of items to enhance the experience and connect men as
            a single Jewish community throughout the retreat.
          </p>
        </div>
        <div className="row justify-content-md-center">
          <form onSubmit={this.handleSubmit}>
            <div className="offset-md-2 col-md-8">
              <div className="form-check my-4">
                <input className="form-check-input" type="checkbox" id="roomChoiceBase"
                  checked={roomChoice === "online_base" && !isCustomDonation} onChange={() => this.onSelectOnlineType("online_base")}
                />
                <label className="form-check-label" htmlFor="roomChoiceBase">
                  <div style={{display: "inline-block"}}>
                    <span className="ml-2 font-weight-bold">{formatMoney(baseFee, 0)}</span>
                    {!!strikeoutFee && <span className="strikeout ml-1">{formatMoney(strikeoutFee, 0)}</span>}
                  </div>
                  <span className="ml-2 font-weight-bold">{baseLabel}</span>
                </label>
              </div>
              <div className="form-check my-4">
                <input className="form-check-input" type="checkbox" id="roomChoiceLevel1"
                  checked={roomChoice === "online_endowment"} onChange={() => this.onSelectOnlineType("online_endowment")}
                />
                <label className="form-check-label" htmlFor="roomChoiceLevel1">
                  <span className="ml-2 font-weight-bold">{formatMoney(event.priceList.roomChoice["online_endowment"], 0)}</span><span className="ml-2 font-weight-bold">Brother Keeper Endowment Level</span>
                    <div className="font-weight-light">
                      Your Brother Keeper Endowment will support Menschwork’s ability to purchase
                      prayer books, Havdalah candles, and other Jewish ritual items for the JMR30
                      Package delivered to each man who registers for JMR30.
                    </div>
                </label>
              </div>
              <div className="form-check my-3">
                <input className="form-check-input" type="checkbox" id="roomChoiceLevel2"
                  checked={roomChoice === "online_mishpacha"} onChange={() => this.onSelectOnlineType("online_mishpacha")}
                />
                <label className="form-check-label" htmlFor="roomChoiceLevel2">
                  <span className="ml-2 font-weight-bold">{formatMoney(event.priceList.roomChoice["online_mishpacha"], 0)}</span><span className="ml-2 font-weight-bold">Brother Keeper Mishpacha Level</span>
                    <div className="font-weight-light">
                      The Mishpacha level is less than most men pay attend the traditional Jewish
                      Men’s Retreat weekend.  Yet, your support as a Brother Keeper Mishpacha will
                      ensure the ability of men to attend JMR30 who may otherwise be unable to
                      afford to do so.  Your generous support will also help support the Jewish
                      Men’s Retreat Fellowship Program for Young Men and allow Menschwork to offer
                      programs such as the Webinar Series, MenschGroups, among its many other
                      current programs and programs in development.
                    </div>
                </label>
              </div>
              <div className="form-check my-4">
                <div>
                  <input className="form-check-input" type="checkbox" id="roomChoiceBasePlus"
                    checked={roomChoice === "online_base" && isCustomDonation} onChange={() => this.onSelectOnlineType("online_base", true)}
                  />
                  <label className="form-check-label" htmlFor="roomChoiceBasePlus">
                    <div style={{display: "inline-block"}}>
                      <span className="ml-2 font-weight-bold">{formatMoney(baseFee, 0)}</span>
                      {!!strikeoutFee && <span className="strikeout ml-1">{formatMoney(strikeoutFee, 0)}</span>}
                    </div>
                    <span className="mx-2 font-weight-bold">+</span>
                    <MoneyField id="donation"
                      amount={donation}
                      onChange={this.handleDonationChange}
                      minimumAmount={100}
                      maximumAmount={500000}
                      disabled={!isCustomDonation}
                      immediate={true}
                    />
                    <span className="ml-2 font-weight-bold">Choose your own additional contribution level</span>
                  </label>
                </div>
                <div className="font-weight-light">
                  Any amount contributed in addition to the registration fee will help Menschwork to provide items for the JMR30
                  Package delivered to each man who registers for JMR30.
                </div>
              </div>
              <p className="font-italic">
                Menschwork, Inc. is recognized by the IRS as a 501(c)(3) charitable organization.
              </p>
            </div>
            <div className="mt-2">
              <button type='submit' className={classNames("btn float-right", roomChoice && "btn-success")} disabled={!canSubmit}>
                {madePayment ? "Save Changes" : "Continue"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  renderDonationSection() {
    const { donationOption, donation } = this.state;

    return (
      <div className="form-group mt-5">
        <h4 className="mt-4">Support Menschwork</h4>
        <p>
          Menschwork has endeavored to minimize the price increase from JMR28 as much as possible. Nevertheless, JMR30 may present a financial challenge
          to some men.  Menschwork offers need-based financial assistance on a funds-available basis.  Please consider your role as a Brother Keeper
          by making a donation in addition to your registration fee.
        </p>
        <div>
          <div className="form-check my-3">
            <input className="form-check-input" type="checkbox" id="donation_mishpacha"
              checked={donationOption === "donation_mishpacha"} onChange={() => this.onSelectDonationType("donation_mishpacha")}
            />
            <label className="form-check-label" htmlFor="donation_mishpacha">
              <span className="ml-2 font-weight-bold">{formatMoney(36000, 0)}</span><span className="ml-2 font-weight-bold">Brother Keeper Mishpacha Level</span>
                <div className="font-weight-light">
                  Your support as a Brother Keeper Mishpacha will ensure the ability of men to attend JMR30 who may otherwise be unable to afford to do.
                  Your generous contribution will also help support the Jewish Men’s Retreat Fellowship Program for Young Men and allow Menschwork to offer
                  programs such as the Webinar Series, MenschGroups, among its many other current programs and programs in development.
                </div>
            </label>
          </div>
          <div className="form-check my-4">
            <input className="form-check-input" type="checkbox" id="donation_endowment"
              checked={donationOption === "donation_endowment"} onChange={() => this.onSelectDonationType("donation_endowment")}
            />
            <label className="form-check-label" htmlFor="donation_endowment">
              <span className="ml-2 font-weight-bold">{formatMoney(18000, 0)}</span><span className="ml-2 font-weight-bold">Brother Keeper Endowment Level</span>
                <div className="font-weight-light">
                Your Brother Keeper Endowment will support Menschwork’s ability to purchase COVID-19 safety and sanitation supplies to help ensure a
                safe retreat for all men attending JMR30.
                </div>
            </label>
          </div>
          <div className="form-check my-4">
            <input className="form-check-input" type="checkbox" id="donation_support"
              checked={donationOption === "donation_support"} onChange={() => this.onSelectDonationType("donation_support")}
            />
            <label className="form-check-label" htmlFor="donation_support">
              <span className="ml-2 font-weight-bold">{formatMoney(9000, 0)}</span><span className="ml-2 font-weight-bold">Brother Keeper Support Level</span>
            </label>
          </div>
          <div className="form-check my-4">
            <div>
              <input className="form-check-input" type="checkbox" id="donation_custom"
                checked={donationOption === "donation_custom"} onChange={() => this.onSelectDonationType("donation_custom")}
              />
              <label className="form-check-label" htmlFor="donation_custom">
                <MoneyField id="donation"
                  amount={donationOption === "donation_custom" && donation}
                  onChange={this.handleDonationChange}
                  minimumAmount={100}
                  maximumAmount={500000}
                  disabled={donationOption !== "donation_custom"}
                  immediate={true}
                />
                <span className="ml-2 font-weight-bold">Brother Keeper Level</span>
              </label>
            </div>
            <div className="font-weight-light">
              Your support as a Brother Keeper, at whatever amount is comfortable for you, will help support Menschwork's programs.
            </div>
          </div>
          <div className="form-check my-4">
            <input className="form-check-input" type="checkbox" id="donation_none"
              checked={donationOption === "donation_none"} onChange={() => this.onSelectDonationType("donation_none")}
            />
            <label className="form-check-label" htmlFor="donation_none">
              <span className="ml-2 font-weight-bold">No Donation at this time</span>
            </label>
          </div>
          <p className="font-italic">
            Menschwork, Inc. is recognized by the IRS as a 501(c)(3) charitable organization.
          </p>
        </div>
      </div>
    );
  }

  render() {
    const { currentUser, event, serverTimestamp, madePayment, order, roomUpgrade, hasBalance, match } = this.props;
    const { roomChoice, submitted, singleSupplement, refrigeratorSelected,
      thursdayNight, roommate, announcement, donationOption, donation } = this.state;

    if (submitted && !currentUser) {
      return (
        <SignIn />
      );
    }

    if (event.onlineOnly) {
      return this.renderOnlineJMR();
    }

    const noRoommate = (!!singleSupplement && roomChoice !== 'dormitory') || roomChoice === 'camper' || roomChoice === 'commuter';
    const noRefrigerator = roomChoice === 'camper' || roomChoice === 'commuter';
    const noThursday = roomChoice === 'commuter';

    //only consider current time for message display
    let preRegistrationDiscount = getPreRegistrationDiscount(currentUser, event, order, serverTimestamp);
    let preRegistrationDiscountDisplay;
    if (!!preRegistrationDiscount) {
      if (preRegistrationDiscount.amount > 1) {
        preRegistrationDiscountDisplay = formatMoney(preRegistrationDiscount.amount, 0);
      } else {
        preRegistrationDiscountDisplay = (100 * preRegistrationDiscount.amount) + "%";
      }
    }
    let earlyDiscountDisplay;
    let earlyDiscount = {};
    if (!preRegistrationDiscount) {
      earlyDiscount = getEarlyDiscount(event, null, serverTimestamp);
      if (!!earlyDiscount) {
        if (earlyDiscount.amount > 1) {
          earlyDiscountDisplay = formatMoney(earlyDiscount.amount, 0);
        } else {
          earlyDiscountDisplay = (100 * earlyDiscount.amount) + "%";
        }
      }
    }
    let roomUpgradeDisplay = isRoomUpgradeAvailable(roomUpgrade, order, event);

    let canSubmit = !!roomChoice;
    if (!donationOption || (donationOption === "donation_custom" && !donation)) {
      canSubmit = false;
    }

    return (
      <div className="mb-4">
        <div className="text-center offset-md-1 col-md-10 intro mb-3">
          <h5 className="font-italic">
            Menschwork invites you to join in the celebration of<br/>
          </h5>
          <h4 className="font-weight-bold">
            Jewish Men&#39;s Retreat 30
          </h4>
          <h4>
            <span className="font-weight-bold">Reimagining the Power of <em>Havdallah!</em></span>
          </h4>
          <h5 className="mb-3">
            <span className="font-weight-bold">Moving from isolation and uncertainty to community and brotherhood.</span><br/>
          </h5>
          <h6>
            <span className="font-italic">Isabella Freedman Jewish Retreat Center, Falls Village, CT - October 15-17, 2021</span>
          </h6>
        </div>
        {!!announcement &&
          <div className="alert alert-info" role="alert">
            <p className="text-center m-0">{announcement}</p>
          </div>
        }
        {!!hasBalance &&
          <div className="alert alert-info" role="alert">
            <p className="text-center m-0">
              Please <Link to={`${match.url}/payment`}>visit the Payment page</Link> to pay the remaining balance on your registration
            </p>
          </div>
        }
        <h5>Lodging and Price Options</h5>
        <p>Please click below to make your lodging choice. All prices are per person and include lodging, meals, and programming. If selecting a multiple occupancy room, you will have a roommate during the retreat. You can request a specific roommate below or we will assign someone.</p>
        {!!preRegistrationDiscountDisplay &&
          <div className="text-danger">
            <h6 className="d-flex justify-content-center">
              As you have pre-registered, the per-person price below includes a LIMITED TIME {preRegistrationDiscountDisplay} DISCOUNT through {moment(preRegistrationDiscount.endDate).format("MMMM Do")}!
            </h6>
          </div>
        }
        {!!earlyDiscountDisplay &&
          <div className="text-danger">
            <h6 className="d-flex justify-content-center">
              The per-person price below includes a LIMITED TIME {earlyDiscountDisplay} DISCOUNT through {moment(earlyDiscount.endDate).format("MMMM Do")}!
            </h6>
          </div>
        }
        {!!roomUpgradeDisplay &&
          <div className="text-danger">
            <h6 className="d-flex justify-content-center">
              As one of the first {event.roomUpgrade.firstN} registrants, you will receive a free room upgrade
              if you register now for a Basic or Standard room!
            </h6>
          </div>
        }
        <div className="row justify-content-md-center">
          <form onSubmit={this.handleSubmit}>
            <div className="d-flex flex-wrap justify-content-center">
              {this.renderRoomChoiceOption('standard')}
              {this.renderRoomChoiceOption('basic')}
              {this.renderRoomChoiceOption('dormitory')}
            </div>
            <div className="d-flex flex-wrap justify-content-center">
              {this.renderRoomChoiceOption('camper')}
              {this.renderRoomChoiceOption('commuter')}
            </div>
            <div className="col-12">
              <h5 className="mt-4">Additional Options</h5>
              <div className="form-check">
                <input className="form-check-input" type="checkbox" id="thursday-night"
                  checked={thursdayNight && !noThursday}
                  disabled={noThursday}
                  onChange={this.onToggleThursdayNight}
                />
                <label className={classNames("form-check-label", noThursday && "disabled")} htmlFor="thursday-night">
                  Thursday evening arrival (for retreat planning team only) - {formatMoney(event.priceList.thursdayNight, 0)}
                </label>
              </div>
              { has(event, 'priceList.refrigerator') &&
                <div className="form-check mt-2">
                  <input className="form-check-input" type="checkbox" id="refrigerator"
                    checked={refrigeratorSelected && !noRefrigerator}
                    disabled={noRefrigerator}
                    onChange={this.onToggleRefrigerator}
                  />
                  <label className={classNames("form-check-label", noRefrigerator && "disabled")} htmlFor="refrigerator">
                    Add a mini-fridge to your room - {formatMoney(event.priceList.refrigerator, 0)}
                  </label>
                </div>
              }
              <div className="form-group mt-4">
                <label htmlFor="roommate" className={classNames("col-form-label col-md-4", noRoommate && "disabled")}>
                  Requested Roommate
                </label>
                <input id="roommate" type="text" className="form-control col-md-6"
                  placeholder="Optional"
                  value={roommate} onChange={this.handleChangeRoommate}
                  disabled={noRoommate}
                />
              </div>
              { this.renderDonationSection() }
              <button type='submit' className={classNames("btn float-right", canSubmit && "btn-success")} disabled={!canSubmit}>
                {madePayment ? "Save Changes" : "Continue"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
}

export default RoomChoice;
