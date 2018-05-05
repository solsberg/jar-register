import React, { Component } from 'react';
import ProfileInputField from './ProfileInputField';

class Profile extends Component {
  constructor(props) {
    super(props);

    this.fieldInfo = {
      first_name: true,
      last_name: true,
      address_1: true,
      city: true,
      state: false,
      post_code: false,
      phone: true,
      phone_2: false,
      emergency_name: true,
      emergency_phone: false
    };

    let state = {};
    Object.keys(this.fieldInfo).forEach(f => {
      state[f] = '';
    });
    this.state = state;
  }

  componentWillMount() {
    const { profile, currentUser } = this.props;
    if (!!profile && !!currentUser) {
      this.initState(currentUser, profile);
    }
  }

  componentWillReceiveProps(nextProps) {
    if (!this.props.profile && !!nextProps.profile) {
      this.initState(nextProps.currentUser, nextProps.profile);
    }
  }

  initState = (currentUser, profile) => {
    let newState = {
      email: currentUser.email,
      hasSubmitted: false
    }
    Object.keys(this.fieldInfo).forEach(k => {
      newState[k] = profile[k];
    });
    this.setState(newState);
  }

  updateField = (fieldName, value) => {
    let updateState = {};
    updateState[fieldName] = value;
    this.setState(updateState);
  }

  handleSubmit = (event) => {
    event.preventDefault();
    const { currentUser, updateProfile, history, match } = this.props;

    this.setState({hasSubmitted: true});

    for (let fieldName in this.fieldInfo) {
      if (this.fieldInfo[fieldName]) {
        const value = this.state[fieldName];
        if (!value || !value.trim()) {
          return;
        }
      }
    }

    let values = {};
    Object.keys(this.fieldInfo).forEach(f => {
      values[f] = (this.state[f] && this.state[f].trim()) || null;
    });
    updateProfile(currentUser, values);

    const parentUrl = match.url.substring(0, match.url.lastIndexOf('/'));
    history.push(parentUrl + '/payment');
  }

  render() {
    const { email, first_name, last_name, address_1, address_2, city, state, post_code,
            phone, phone_2, emergency_name, emergency_phone, hasSubmitted } = this.state || {};

    return (
      <div className="mt-3">
        <h3 className="text-center">
          Profile
        </h3>

        <div className="row justify-content-center">
          <div className="col col-md-10">
            <form onSubmit={this.handleSubmit}>
              <div className="form-group">
                <label htmlFor='email'>Email</label>
                <input id='email' type='email' className="form-control" value={email} readOnly />
              </div>
              <div className="form-row">
                <ProfileInputField className="col-md-6" id='first_name' label='First Name'
                  value={first_name} onChange={this.updateField} required
                  validate={hasSubmitted} invalidText='Please enter your first name'
                />
                <ProfileInputField className="col-md-6" id='last_name' label='Last Name'
                  value={last_name} onChange={this.updateField} required
                  validate={hasSubmitted} invalidText='Please enter your last name'
                />
              </div>
              <div className="form-row">
                <ProfileInputField className="col-md-6" id='address_1' label='Address (Line 1)'
                  value={address_1} onChange={this.updateField} required
                  validate={hasSubmitted} invalidText='Please enter your address'
                />
                <ProfileInputField className="col-md-6" id='address_2' label='Address (Line 2)'
                  value={address_2} onChange={this.updateField}
                />
              </div>
              <div className="form-row">
                <ProfileInputField className="col-md-6" id='city' label='City'
                  value={city} onChange={this.updateField} required
                  validate={hasSubmitted} invalidText='Please enter your city'
                />
                <ProfileInputField className="col-md-3" id='state' label='State'
                  value={state} onChange={this.updateField}
                />
                <ProfileInputField className="col-md-3" id='post_code' label='ZIP'
                  value={post_code} onChange={this.updateField}
                />
              </div>
              <div className="form-row">
                <ProfileInputField className="col-md-6" id='phone' label='Phone'
                  value={phone} onChange={this.updateField} required
                  validate={hasSubmitted} invalidText='Please enter your phone number'
                />
                <ProfileInputField className="col-md-6" id='phone_2' label='Alternate Phone'
                  value={phone_2} onChange={this.updateField}
                />
              </div>
              <div className="form-row">
                <ProfileInputField className="col-md-6" id='emergency_name' label='Emergency Contact Name'
                  value={emergency_name} onChange={this.updateField} required
                  validate={hasSubmitted} invalidText='Please enter an emergency contact'
                />
                <ProfileInputField className="col-md-6" id='emergency_phone' label='Emergency Contact Phone'
                  value={emergency_phone} onChange={this.updateField} required
                  validate={hasSubmitted} invalidText='Please enter the emergency contact phone number'
                />
              </div>
              <button type='submit' className="btn btn-success mr-5">Continue</button>
            </form>
          </div>
        </div>
      </div>
    );
  }
}

export default Profile;
