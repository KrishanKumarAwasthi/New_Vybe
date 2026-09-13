import React, { useState } from 'react'
import logo from "../assets/logo2.png"
import logo1 from "../assets/logo.png"
import { IoIosEye } from "react-icons/io";
import { IoIosEyeOff } from "react-icons/io";
import axios from "axios"
import { serverUrl } from '../App';
import { ClipLoader } from "react-spinners";
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setUserData } from '../redux/userSlice';
function SignIn() {

const [showPassword,setShowPassword]=useState(false)
const [loading,setLoading]=useState(false)
const [userName,setUserName]=useState("")
const [password,setPassword]=useState("")
const [err,setErr]=useState("")
const navigate=useNavigate()
const dispatch=useDispatch()
const handleSignIn=async ()=>{
  setLoading(true)
  setErr("")
  if (!userName || !password) {
      setErr("Username and password are required")
      setLoading(false)
      return
  }
  try {
    const result=await axios.post(`${serverUrl}/api/auth/signin`,{userName,password},{withCredentials:true})
    dispatch(setUserData(result.data))
    setLoading(false)
    navigate("/")
  } catch (error) {
    console.log(error)
    setLoading(false)
    setErr(error.response?.data?.message || "Sign in failed. Please try again.")
  }
}


  return (
    <div className='w-full h-screen bg-gradient-to-b from-black to-gray-900 flex flex-col justify-center items-center'>
      <div className='w-[90%] lg:max-w-[60%]  h-[600px] bg-white rounded-2xl flex justify-center items-center overflow-hidden border-2 border-[#1a1f23]'>
<div className='w-full lg:w-[50%] h-full bg-white flex flex-col items-center justify-center p-[10px] gap-[20px]'>

<div className='flex gap-[10px] items-center text-[20px] font-semibold mt-[40px]'>
    <span>Sign In to </span>
    <img src={logo} alt="" className='w-[70px]'/>
</div>


<div className='relative flex items-center justify-start w-[90%] h-[50px] rounded-2xl border-2 border-black'>
    <input type="text" id='userName' placeholder=" " className='peer w-[100%] h-[100%] rounded-2xl px-[20px] outline-none border-0 bg-transparent' required onChange={(e)=>setUserName(e.target.value)} value={userName}/>
    <label htmlFor='userName' className="text-gray-700 absolute left-[20px] px-[5px] bg-white text-[15px] transition-all duration-300 pointer-events-none top-[-15px] peer-placeholder-shown:top-[12px] peer-focus:top-[-15px]"> Enter Username</label>
</div>

<div className='relative flex items-center justify-start w-[90%] h-[50px] rounded-2xl border-2 border-black'>
    <input type={showPassword?"text":"password"} id='password' placeholder=" " className='peer w-[100%] h-[100%] rounded-2xl px-[20px] outline-none border-0 bg-transparent' required onChange={(e)=>setPassword(e.target.value)} value={password}/>
    <label htmlFor='password' className="text-gray-700 absolute left-[20px] px-[5px] bg-white text-[15px] transition-all duration-300 pointer-events-none top-[-15px] peer-placeholder-shown:top-[12px] peer-focus:top-[-15px]"> Enter password</label>
        {!showPassword?<IoIosEye className='absolute cursor-pointer right-[20px] w-[25px] h-[25px]' onClick={()=>setShowPassword(true)}/>:<IoIosEyeOff className='absolute cursor-pointer right-[20px] w-[25px] h-[25px]' onClick={()=>setShowPassword(false)}/>} 
        
</div>
<div className='w-[90%] px-[20px] cursor-pointer' onClick={()=>navigate("/forgot-password")}>Forgot Password</div>

{err && <p className='text-red-500'>{err}</p>}

<button className='w-[70%] px-[20px] py-[10px] bg-black text-white font-semibold h-[50px] cursor-pointer rounded-2xl mt-[30px]' onClick={handleSignIn} disabled={loading}>{loading?<ClipLoader size={30} color='white'/>:"Sign In"}</button>
<p className='cursor-pointer text-gray-800' onClick={()=>navigate("/signup")}>Want To Create A New Account ? <span className='border-b-2 border-b-black pb-[3px] text-black'>Sign Up</span></p>
</div>
<div className='md:w-[50%] h-full hidden lg:flex justify-center items-center bg-[#000000] flex-col gap-[10px] text-white text-[16px] font-semibold rounded-l-[30px] shadow-2xl shadow-black'>

<img src={logo1} alt="" className='w-[40%]'/>
<p >Not Just A Platform , It's A VYBE</p>
</div>
      </div>
    </div>
  )
}

export default SignIn
